import UIKit
import Capacitor

/// アプリの画面（ページをひらく WKWebView）。このアプリだけのプラグインをここで登録する
class MainViewController: CAPBridgeViewController {
    private var loadingObservation: NSKeyValueObservation?
    private var cornerLeft: CGFloat = 0

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PianoMidiPlugin())
        bridge?.registerPluginInstance(PianoHapticsPlugin())
        // 画面の左はしから右へスワイプして、まえのページへもどる（iOS のアプリとおなじ）
        webView?.allowsBackForwardNavigationGestures = true
        // ページをよみこむたびに、左上のよけるはばをページへわたす（ページがかわると CSS の値は消えるので）
        loadingObservation = webView?.observe(\.isLoading, options: [.new]) { [weak self] webView, _ in
            if !webView.isLoading { self?.sendCornerInset() }
        }
    }

    // iPadOS 26 のウインドウ表示：左上の窓のボタン（とじる・ちいさく など）がページの上にかさなる。
    // ふつうの safe area にはふくまれないので、角をよける layout region とのちがいを
    // CSS の --pa-corner-left にわたす（app.css の上のバーがその分だけ右へ。全画面のときは 0）
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard #available(iOS 26.0, *) else { return }
        let corner = view.layoutGuide(for: .safeArea(cornerAdaptation: .horizontal)).layoutFrame
        let left = max(0, corner.minX - view.safeAreaLayoutGuide.layoutFrame.minX)
        if abs(left - cornerLeft) > 0.5 {
            cornerLeft = left
            sendCornerInset()
        }
    }

    private func sendCornerInset() {
        let px = Int(cornerLeft.rounded())
        webView?.evaluateJavaScript("document.documentElement.style.setProperty('--pa-corner-left','\(px)px')", completionHandler: nil)
    }

    // VoiceOver の「2本指で Z をかく」：ひらいているシート（調・⚙️）があればとじる。なければ、まえのページへもどる
    override func accessibilityPerformEscape() -> Bool {
        guard let webView = webView else { return false }
        let closeSheet = "(function(){var d=document.querySelector('dialog[open]');if(d){d.close();return 1;}return 0;})()"
        webView.evaluateJavaScript(closeSheet) { result, _ in
            let closed = (result as? NSNumber)?.intValue == 1
            if !closed && webView.canGoBack { webView.goBack() }
        }
        return true
    }
}
