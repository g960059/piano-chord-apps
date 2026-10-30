import Foundation
import UIKit
import Capacitor
import CoreMIDI
import CoreAudioKit

/// 電子ピアノ（MIDI）の入力。JS がわは assets/native.js（PA.midi）。
///
/// USB でつないだ機器も、Bluetooth でつないだ機器も、CoreMIDI の「ソース」になるので、ぜんぶうけとる。
/// ネイティブがわはアプリがうごいているあいだずっとつないだまま（ページがかわっても、start でいまの機器をかえすだけ）。
///
/// JS へのイベント
///   "midi"    … {type: "note", on: Bool, note: 0〜127, velocity: 0〜127} / {type: "pedal", on: Bool}（サステインペダル）
///   "devices" … {devices: [機器の名前]}（つないだ・はずしたとき）
/// メソッド
///   start()         … つなぐ（2回目からは なにもしない）。かえす：{devices}
///   showBluetooth() … Bluetooth の MIDI 機器をさがしてつなぐ画面（iOS の CABTMIDICentralViewController）。とじたら {devices}
@objc(PianoMidiPlugin)
public class PianoMidiPlugin: CAPPlugin, CAPBridgedPlugin, UIAdaptivePresentationControllerDelegate {
    public let identifier = "PianoMidiPlugin"
    public let jsName = "PianoMidi"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showBluetooth", returnType: CAPPluginReturnPromise)
    ]

    private var client = MIDIClientRef()
    private var port = MIDIPortRef()
    private var connected = Set<MIDIEndpointRef>()
    private var btCall: CAPPluginCall?

    // UMP（MIDI 2.0 のかたち）のメッセージの長さ（ワード数）。上の4ビット（メッセージの種類）ごと
    private static let umpWords: [Int] = [1, 1, 1, 2, 2, 4, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4]

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.client == 0 && !self.setup() {
                call.reject("MIDI をつかえませんでした")
                return
            }
            self.connectSources()
            call.resolve(["devices": self.deviceNames()])
        }
    }

    @objc func showBluetooth(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("画面がありません")
                return
            }
            if self.client == 0 { _ = self.setup() }
            self.btCall?.resolve(["devices": self.deviceNames()])
            self.btCall = call
            let bt = CABTMIDICentralViewController()
            bt.title = "電子ピアノとつなぐ"
            bt.navigationItem.rightBarButtonItem = UIBarButtonItem(
                barButtonSystemItem: .done, target: self, action: #selector(self.closeBluetooth))
            let nav = UINavigationController(rootViewController: bt)
            nav.modalPresentationStyle = .formSheet
            nav.presentationController?.delegate = self
            presenter.present(nav, animated: true)
        }
    }

    @objc private func closeBluetooth() {
        bridge?.viewController?.dismiss(animated: true) { self.bluetoothClosed() }
    }

    // 下にスワイプしてとじたとき
    public func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        bluetoothClosed()
    }

    private func bluetoothClosed() {
        connectSources()
        btCall?.resolve(["devices": deviceNames()])
        btCall = nil
        notifyDevices()
    }

    private func setup() -> Bool {
        let status = MIDIClientCreateWithBlock("PianoChord" as CFString, &client) { [weak self] note in
            guard note.pointee.messageID == .msgSetupChanged else { return }
            DispatchQueue.main.async {
                self?.connectSources()
                self?.notifyDevices()
            }
        }
        guard status == noErr else { client = 0; return false }
        let portStatus = MIDIInputPortCreateWithProtocol(client, "Input" as CFString, ._1_0, &port) { [weak self] list, _ in
            self?.receive(list)
        }
        guard portStatus == noErr else { MIDIClientDispose(client); client = 0; return false }
        return true
    }

    // いまあるソースにぜんぶつなぐ（なくなったものはわすれる）
    private func connectSources() {
        guard port != 0 else { return }
        var now = Set<MIDIEndpointRef>()
        // iOS のネットワーク MIDI（「Session 1」）は、いつもあるソースなので電子ピアノとしてかぞえない
        let network = MIDINetworkSession.default().sourceEndpoint()
        for i in 0..<MIDIGetNumberOfSources() {
            let src = MIDIGetSource(i)
            guard src != 0, src != network else { continue }
            now.insert(src)
            if !connected.contains(src) { MIDIPortConnectSource(port, src, nil) }
        }
        connected = now
    }

    private func deviceNames() -> [String] {
        var names: [String] = []
        for src in connected {
            var offline: Int32 = 0
            if MIDIObjectGetIntegerProperty(src, kMIDIPropertyOffline, &offline) == noErr && offline != 0 { continue }
            var name: Unmanaged<CFString>?
            if MIDIObjectGetStringProperty(src, kMIDIPropertyDisplayName, &name) == noErr, let n = name?.takeRetainedValue() {
                names.append(n as String)
            } else {
                names.append("MIDI")
            }
        }
        return names.sorted()
    }

    private func notifyDevices() {
        notifyListeners("devices", data: ["devices": deviceNames()])
    }

    // MIDI のスレッドでよばれる。ノートのオン・オフとペダルだけをひろって、メインスレッドで JS へ
    private func receive(_ list: UnsafePointer<MIDIEventList>) {
        var events: [[String: Any]] = []
        for packet in list.unsafeSequence() {
            let words = Array(packet.words()) // wordCount だけ読む（パケットの形をまるごとコピーしない）
            var i = 0
            while i < words.count {
                let w = words[i]
                let mt = Int(w >> 28)
                if i + PianoMidiPlugin.umpWords[mt] > words.count { break }
                if mt == 2 { // MIDI 1.0 のチャンネルのメッセージ
                    let status = (w >> 16) & 0xF0, d1 = Int((w >> 8) & 0x7F), d2 = Int(w & 0x7F)
                    switch status {
                    case 0x90: events.append(["type": "note", "on": d2 > 0, "note": d1, "velocity": d2])
                    case 0x80: events.append(["type": "note", "on": false, "note": d1, "velocity": 0])
                    case 0xB0 where d1 == 64: events.append(["type": "pedal", "on": d2 >= 64])
                    default: break
                    }
                }
                i += PianoMidiPlugin.umpWords[mt]
            }
        }
        guard !events.isEmpty else { return }
        DispatchQueue.main.async {
            for e in events { self.notifyListeners("midi", data: e) }
        }
    }

    deinit {
        if client != 0 { MIDIClientDispose(client) }
    }
}
