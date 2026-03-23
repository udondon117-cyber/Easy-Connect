// ============================================================
// withAudioCapture.js
// 役割：内部音声キャプチャ（MediaProjection）ネイティブモジュール
//       EAS Build時にKotlinソースをAndroidプロジェクトに注入する
//       対象：デバイス内部の音声（YouTube等）を字幕化する機能
// ============================================================

const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

// ===== AudioCaptureModule.kt =====
// デバイス内部の音声をMediaProjectionでキャプチャし
// 3秒ごとにBase64 PCMチャンクをDeviceEventEmitter経由でJSへ送る
const AUDIO_CAPTURE_MODULE_KT = `package com.udona.captionbridge

import android.app.Activity
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import java.io.ByteArrayOutputStream

// デバイス内部の音声（YouTube等）をキャプチャして字幕用チャンクをJSへ送るモジュール
class AudioCaptureModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    companion object {
        const val MODULE_NAME = "AudioCaptureModule"
        const val REQUEST_CODE = 2001
        const val SAMPLE_RATE = 16000
        const val CHUNK_SECONDS = 3L
    }

    private var mediaProjection: MediaProjection? = null
    private var audioRecord: AudioRecord? = null
    private var captureJob: Job? = null
    private var capturePromise: Promise? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName() = MODULE_NAME

    // MediaProjection許可ダイアログを表示してユーザーに承認を求める
    @ReactMethod
    fun requestCapture(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            promise.reject("UNSUPPORTED", "内部音声キャプチャはAndroid 10以上が必要です")
            return
        }
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "アクティビティが見つかりません")
            return
        }
        capturePromise = promise
        val manager = activity.getSystemService(MediaProjectionManager::class.java)
        activity.startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_CODE)
    }

    // 内部音声キャプチャを開始する
    // 3秒ごとにBase64エンコードされたPCMチャンクをAudioCaptureChunkイベントで送信する
    @ReactMethod
    fun startCapture() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        val mp = mediaProjection ?: return
        startCaptureLoop(mp)
    }

    // 内部音声キャプチャを停止する
    @ReactMethod
    fun stopCapture() {
        captureJob?.cancel()
        captureJob = null
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null
        mediaProjection?.stop()
        mediaProjection = null
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    private fun startCaptureLoop(mp: MediaProjection) {
        val minBuf = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        val bufSize = maxOf(minBuf, 4096) * 4

        // 内部再生音声のみキャプチャする設定
        val captureConfig = AudioPlaybackCaptureConfiguration.Builder(mp)
            .addMatchingUsage(android.media.AudioAttributes.USAGE_MEDIA)
            .addMatchingUsage(android.media.AudioAttributes.USAGE_GAME)
            .addMatchingUsage(android.media.AudioAttributes.USAGE_UNKNOWN)
            .build()

        audioRecord = AudioRecord.Builder()
            .setAudioPlaybackCaptureConfig(captureConfig)
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                    .build()
            )
            .setBufferSizeInBytes(bufSize)
            .build()

        audioRecord?.startRecording()

        captureJob = scope.launch {
            // 3秒分のバイト数（PCM16bit・モノラル・16000Hz = 96000バイト）
            val chunkBytes = (SAMPLE_RATE * 2 * CHUNK_SECONDS).toInt()
            val readBuf = ByteArray(minBuf)
            val accumBuf = ByteArrayOutputStream()

            while (isActive) {
                val read = audioRecord?.read(readBuf, 0, readBuf.size) ?: break
                if (read > 0) {
                    accumBuf.write(readBuf, 0, read)
                    if (accumBuf.size() >= chunkBytes) {
                        val pcmData = accumBuf.toByteArray()
                        accumBuf.reset()
                        val b64 = Base64.encodeToString(pcmData, Base64.NO_WRAP)
                        // メインスレッドでJSへ字幕用チャンクを送信する
                        Handler(Looper.getMainLooper()).post {
                            reactApplicationContext
                                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                                .emit("AudioCaptureChunk", b64)
                        }
                    }
                }
            }
        }
    }

    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        if (requestCode != REQUEST_CODE) return
        if (resultCode == Activity.RESULT_OK && data != null) {
            val manager = activity.getSystemService(MediaProjectionManager::class.java)
            mediaProjection = manager.getMediaProjection(resultCode, data)
            capturePromise?.resolve(true)
        } else {
            capturePromise?.reject("DENIED", "画面キャプチャが拒否されました")
        }
        capturePromise = null
    }

    override fun onNewIntent(intent: Intent?) {}

    override fun invalidate() {
        super.invalidate()
        stopCapture()
        scope.cancel()
    }
}
`;

// ===== AudioCapturePackage.kt =====
const AUDIO_CAPTURE_PACKAGE_KT = `package com.udona.captionbridge

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

// AudioCaptureModuleをReact Nativeに登録するパッケージ
class AudioCapturePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(AudioCaptureModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

// ===== Kotlinファイルを書き込み、MainApplication.ktにパッケージを登録する =====
function withAudioCaptureKotlin(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const pkgPath = path.join(
        projectRoot,
        "android/app/src/main/java/com/udona/captionbridge"
      );

      fs.mkdirSync(pkgPath, { recursive: true });
      fs.writeFileSync(path.join(pkgPath, "AudioCaptureModule.kt"), AUDIO_CAPTURE_MODULE_KT);
      fs.writeFileSync(path.join(pkgPath, "AudioCapturePackage.kt"), AUDIO_CAPTURE_PACKAGE_KT);

      // MainApplication.ktにAudioCapturePackageを登録する
      const mainAppPath = path.join(pkgPath, "MainApplication.kt");
      if (fs.existsSync(mainAppPath)) {
        let content = fs.readFileSync(mainAppPath, "utf-8");
        if (!content.includes("AudioCapturePackage")) {
          // importを追加する（OverlayPackageの後、またはApplicationLifecycleDispatcherの前）
          if (content.includes("import com.udona.captionbridge.OverlayPackage")) {
            content = content.replace(
              "import com.udona.captionbridge.OverlayPackage",
              "import com.udona.captionbridge.OverlayPackage\nimport com.udona.captionbridge.AudioCapturePackage"
            );
          } else {
            content = content.replace(
              "import expo.modules.ApplicationLifecycleDispatcher",
              "import com.udona.captionbridge.AudioCapturePackage\nimport expo.modules.ApplicationLifecycleDispatcher"
            );
          }

          // getPackages()にAudioCapturePackageを追加する
          if (content.includes("packages.add(OverlayPackage())")) {
            content = content.replace(
              "packages.add(OverlayPackage())",
              "packages.add(OverlayPackage())\n        packages.add(AudioCapturePackage())"
            );
          } else {
            content = content.replace(
              "return PackageList(this).packages",
              "val packages = PackageList(this).packages\n        packages.add(AudioCapturePackage())\n        return packages"
            );
          }

          fs.writeFileSync(mainAppPath, content);
        }
      }

      return config;
    },
  ]);
}

// ===== プラグインのエントリーポイント =====
module.exports = function withAudioCapture(config) {
  config = withAudioCaptureKotlin(config);
  return config;
};
