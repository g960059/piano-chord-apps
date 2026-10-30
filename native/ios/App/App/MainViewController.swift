import UIKit
import Capacitor

/// アプリの画面（ページをひらく WKWebView）。このアプリだけのプラグインをここで登録する
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PianoMidiPlugin())
        bridge?.registerPluginInstance(PianoHapticsPlugin())
        // 画面の左はしから右へスワイプして、まえのページへもどる（iOS のアプリとおなじ）
        webView?.allowsBackForwardNavigationGestures = true
    }

    // VoiceOver の「2本指で Z をかく」でも、まえのページへもどる
    override func accessibilityPerformEscape() -> Bool {
        guard let webView = webView, webView.canGoBack else { return false }
        webView.goBack()
        return true
    }
}
