// ============================================================
// withOverlay.js
// 役割：Androidシステムオーバーレイ（他のアプリの上に字幕表示）
//       EAS Build時にKotlinソースとAndroidManifest設定を自動注入する
// ============================================================

const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

// ===== OverlayService.kt =====
const OVERLAY_SERVICE_KT = `package com.udona.captionbridge

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.WindowManager
import android.widget.TextView
import androidx.core.app.NotificationCompat

// 他のアプリの上に字幕を表示するフォアグラウンドサービス
class OverlayService : Service() {
    private var windowManager: WindowManager? = null
    private var overlayView: TextView? = null
    private val handler = Handler(Looper.getMainLooper())

    override fun onBind(intent: Intent): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForegroundNotification()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    }

    // フォアグラウンドサービス用の通知を作成する（Android必須）
    private fun startForegroundNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "CaptionBridge 字幕オーバーレイ",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "他のアプリの上に字幕を表示しています"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)
                ?.createNotificationChannel(channel)
        }

        // タップするとアプリに戻れる通知
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CaptionBridge")
            .setContentText("字幕オーバーレイ動作中 — タップして戻る")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SHOW -> showOverlay()
            ACTION_HIDE -> {
                hideOverlay()
                stopSelf()
            }
            ACTION_UPDATE -> {
                val text = intent.getStringExtra(EXTRA_CAPTION) ?: return START_STICKY
                updateCaption(text)
            }
        }
        return START_STICKY
    }

    // オーバーレイウィンドウを表示する
    private fun showOverlay() {
        if (overlayView != null) return

        overlayView = TextView(this).apply {
            text = "字幕待機中..."
            textSize = 18f
            setTextColor(Color.WHITE)
            setShadowLayer(4f, 1f, 1f, Color.argb(200, 0, 0, 0))
            setPadding(24, 14, 24, 14)
            setBackgroundColor(Color.argb(185, 8, 8, 20))
            typeface = Typeface.DEFAULT_BOLD
        }

        // Android 8.0以上はTYPE_APPLICATION_OVERLAYを使用する
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else
            @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM
            y = 200
        }

        // 上下ドラッグ対応
        var initialY = 0
        var initialTouchY = 0f
        overlayView?.setOnTouchListener { v, event ->
            val lp = v.layoutParams as WindowManager.LayoutParams
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialY = lp.y
                    initialTouchY = event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    lp.y = initialY - (event.rawY - initialTouchY).toInt()
                    windowManager?.updateViewLayout(v, lp)
                    true
                }
                else -> false
            }
        }

        handler.post { windowManager?.addView(overlayView, params) }
    }

    // オーバーレイウィンドウを非表示にする
    private fun hideOverlay() {
        handler.post {
            overlayView?.let { v ->
                try { windowManager?.removeView(v) } catch (_: Exception) {}
            }
            overlayView = null
        }
    }

    // 字幕テキストを更新する
    private fun updateCaption(text: String) {
        handler.post { overlayView?.text = text }
    }

    override fun onDestroy() {
        super.onDestroy()
        hideOverlay()
    }

    companion object {
        const val CHANNEL_ID = "caption_overlay_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_SHOW = "com.udona.captionbridge.OVERLAY_SHOW"
        const val ACTION_HIDE = "com.udona.captionbridge.OVERLAY_HIDE"
        const val ACTION_UPDATE = "com.udona.captionbridge.OVERLAY_UPDATE"
        const val EXTRA_CAPTION = "caption"
    }
}
`;

// ===== OverlayModule.kt =====
const OVERLAY_MODULE_KT = `package com.udona.captionbridge

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// React NativeからオーバーレイサービスをコントロールするNativeModule
class OverlayModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "OverlayModule"

    // 「他のアプリの上に重ねて表示」権限があるか確認する
    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        val can = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            Settings.canDrawOverlays(reactContext)
        else true
        promise.resolve(can)
    }

    // システム設定画面を開いて権限を要求する
    @ReactMethod
    fun requestPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            !Settings.canDrawOverlays(reactContext)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + reactContext.packageName)
            ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
            reactContext.startActivity(intent)
        }
    }

    // オーバーレイサービスを起動してフローティングウィンドウを表示する
    @ReactMethod
    fun showOverlay() {
        val intent = Intent(reactContext, OverlayService::class.java).apply {
            action = OverlayService.ACTION_SHOW
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    // オーバーレイを非表示にしてサービスを停止する
    @ReactMethod
    fun hideOverlay() {
        val intent = Intent(reactContext, OverlayService::class.java).apply {
            action = OverlayService.ACTION_HIDE
        }
        reactContext.startService(intent)
    }

    // 表示中の字幕テキストを更新する
    @ReactMethod
    fun updateCaption(text: String) {
        val intent = Intent(reactContext, OverlayService::class.java).apply {
            action = OverlayService.ACTION_UPDATE
            putExtra(OverlayService.EXTRA_CAPTION, text)
        }
        reactContext.startService(intent)
    }
}
`;

// ===== OverlayPackage.kt =====
const OVERLAY_PACKAGE_KT = `package com.udona.captionbridge

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

// OverlayModuleをReact Nativeに登録するパッケージ
class OverlayPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(OverlayModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

// ===== パーミッションをAndroidManifestに追加 =====
function withOverlayManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    // uses-permission の配列を確保する
    if (!manifest.manifest["uses-permission"]) {
      manifest.manifest["uses-permission"] = [];
    }

    const permsToAdd = [
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MICROPHONE",
      "android.permission.POST_NOTIFICATIONS",
    ];

    permsToAdd.forEach((perm) => {
      const has = manifest.manifest["uses-permission"].some(
        (p) => p.$["android:name"] === perm
      );
      if (!has) {
        manifest.manifest["uses-permission"].push({
          $: { "android:name": perm },
        });
      }
    });

    // OverlayServiceをapplicationに追加する
    const application = manifest.manifest.application[0];
    if (!application.service) application.service = [];

    const hasService = application.service.some(
      (s) => s.$["android:name"] === ".OverlayService"
    );
    if (!hasService) {
      application.service.push({
        $: {
          "android:name": ".OverlayService",
          "android:enabled": "true",
          "android:exported": "false",
          "android:foregroundServiceType": "microphone",
        },
      });
    }

    return config;
  });
}

// ===== KotlinファイルをAndroidプロジェクトに書き込む =====
function withOverlayKotlin(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const pkgPath = path.join(
        projectRoot,
        "android/app/src/main/java/com/udona/captionbridge"
      );

      fs.mkdirSync(pkgPath, { recursive: true });
      fs.writeFileSync(path.join(pkgPath, "OverlayService.kt"), OVERLAY_SERVICE_KT);
      fs.writeFileSync(path.join(pkgPath, "OverlayModule.kt"), OVERLAY_MODULE_KT);
      fs.writeFileSync(path.join(pkgPath, "OverlayPackage.kt"), OVERLAY_PACKAGE_KT);

      // MainApplication.ktにOverlayPackageを登録する
      const mainAppPath = path.join(pkgPath, "MainApplication.kt");
      if (fs.existsSync(mainAppPath)) {
        let content = fs.readFileSync(mainAppPath, "utf-8");
        if (!content.includes("OverlayPackage")) {
          // importを追加する
          content = content.replace(
            "import expo.modules.ApplicationLifecycleDispatcher",
            "import com.udona.captionbridge.OverlayPackage\nimport expo.modules.ApplicationLifecycleDispatcher"
          );
          // getPackages()にOverlayPackageを追加する
          content = content.replace(
            "return PackageList(this).packages",
            "val packages = PackageList(this).packages\n        packages.add(OverlayPackage())\n        return packages"
          );
          fs.writeFileSync(mainAppPath, content);
        }
      }

      return config;
    },
  ]);
}

// ===== プラグインのエントリーポイント =====
module.exports = function withOverlay(config) {
  config = withOverlayManifest(config);
  config = withOverlayKotlin(config);
  return config;
};
