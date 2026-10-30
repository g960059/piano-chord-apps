import UIKit
import Capacitor

/// ふるえ（ハプティクス）。JS がわは assets/native.js（PA.haptic）。iPhone だけ（iPad にはふるえるしくみがないので、なにもおきない）。
/// iOS の「設定 → サウンドと触覚 → システムの触覚」がオフなら、iOS がふるえさせない。
///
/// play({kind}) … kind：
///   "success"   … 正解（UINotificationFeedbackGenerator の success）
///   "light"     … まちがい・軽い合図（UIImpactFeedbackGenerator .light。error の3回ふるえは、しかられているようなのでつかわない）
///   "medium"    … 2回おすボタンの1回め（.medium）
///   "selection" … えらぶ（UISelectionFeedbackGenerator）
@objc(PianoHapticsPlugin)
public class PianoHapticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PianoHapticsPlugin"
    public let jsName = "PianoHaptics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnNone)
    ]

    private lazy var notification = UINotificationFeedbackGenerator()
    private lazy var light = UIImpactFeedbackGenerator(style: .light)
    private lazy var medium = UIImpactFeedbackGenerator(style: .medium)
    private lazy var selection = UISelectionFeedbackGenerator()

    @objc func play(_ call: CAPPluginCall) {
        let kind = call.getString("kind") ?? ""
        DispatchQueue.main.async {
            switch kind {
            case "success": self.notification.notificationOccurred(.success)
            case "light": self.light.impactOccurred()
            case "medium": self.medium.impactOccurred()
            case "selection": self.selection.selectionChanged()
            default: break
            }
        }
    }
}
