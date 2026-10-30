import UIKit
import Capacitor

/// アプリの画面（ページをひらく WKWebView）。このアプリだけのプラグインをここで登録する
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PianoMidiPlugin())
    }
}
