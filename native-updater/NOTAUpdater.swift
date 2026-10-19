import CryptoKit
import Dispatch
import Foundation

private let hostName = "ai.nota.labeling_updater"
private let releasePrefix = "https://github.com/tanmainhat0502/dms_annotation_extension/releases/download/"

private struct UpdaterFailure: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

private func fail(_ message: String) throws -> Never {
    throw UpdaterFailure(message: message)
}

private func dictionary(_ value: Any?, _ message: String) throws -> [String: Any] {
    guard let result = value as? [String: Any] else { try fail(message) }
    return result
}

private func text(_ source: [String: Any], _ key: String) throws -> String {
    guard let value = source[key] as? String, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        try fail("Thiếu cấu hình \(key).")
    }
    return value
}

private func compareVersions(_ left: String, _ right: String) -> Int {
    let a = left.split(separator: ".").map { Int($0) ?? 0 }
    let b = right.split(separator: ".").map { Int($0) ?? 0 }
    for index in 0..<max(a.count, b.count) {
        let x = index < a.count ? a[index] : 0
        let y = index < b.count ? b[index] : 0
        if x != y { return x < y ? -1 : 1 }
    }
    return 0
}

private func fetch(_ urlString: String) throws -> Data {
    guard let url = URL(string: urlString) else { try fail("Đường dẫn tải không hợp lệ.") }
    var request = URLRequest(url: url)
    request.setValue("NOTA-Labeling-Updater", forHTTPHeaderField: "User-Agent")
    request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
    let semaphore = DispatchSemaphore(value: 0)
    var result: Result<Data, Error>?
    URLSession.shared.dataTask(with: request) { data, response, error in
        defer { semaphore.signal() }
        if let error = error {
            result = .failure(error)
            return
        }
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode), let data = data else {
            result = .failure(UpdaterFailure(message: "GitHub trả về lỗi tải dữ liệu."))
            return
        }
        result = .success(data)
    }.resume()
    semaphore.wait()
    guard let result = result else { try fail("Không nhận được dữ liệu từ GitHub.") }
    return try result.get()
}

private func runProcess(_ executable: String, _ arguments: [String]) throws -> String {
    let process = Process()
    let output = Pipe()
    let errors = Pipe()
    process.executableURL = URL(fileURLWithPath: executable)
    process.arguments = arguments
    process.standardOutput = output
    process.standardError = errors
    try process.run()
    process.waitUntilExit()
    let stdout = output.fileHandleForReading.readDataToEndOfFile()
    let stderr = errors.fileHandleForReading.readDataToEndOfFile()
    guard process.terminationStatus == 0 else {
        let detail = String(data: stderr, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        try fail(detail.isEmpty ? "Không xử lý được gói update." : detail)
    }
    return String(data: stdout, encoding: .utf8) ?? ""
}

private func validateZipEntries(_ zip: URL) throws {
    let listing = try runProcess("/usr/bin/unzip", ["-Z1", zip.path])
    for raw in listing.split(separator: "\n", omittingEmptySubsequences: true) {
        let entry = String(raw).replacingOccurrences(of: "\\", with: "/")
        let components = entry.split(separator: "/", omittingEmptySubsequences: false)
        if entry.hasPrefix("/") || components.contains("..") {
            try fail("Gói update chứa đường dẫn không an toàn.")
        }
    }
}

private func validatePayload(_ payload: URL, expectedVersion: String) throws {
    let fileManager = FileManager.default
    for required in ["manifest.json", "content.js", "popup.html", "popup.js"] {
        guard fileManager.fileExists(atPath: payload.appendingPathComponent(required).path) else {
            try fail("Gói update thiếu \(required).")
        }
    }
    let manifestData = try Data(contentsOf: payload.appendingPathComponent("manifest.json"))
    let manifest = try dictionary(try JSONSerialization.jsonObject(with: manifestData), "Manifest không hợp lệ.")
    guard try text(manifest, "name") == "NOTA Labeling Organizer" else { try fail("Sai extension trong gói update.") }
    guard try text(manifest, "version") == expectedVersion else { try fail("Version trong manifest không khớp Release.") }
}

private func copyPayload(_ payload: URL, to extensionRoot: URL) throws {
    let fileManager = FileManager.default
    let keys: [URLResourceKey] = [.isDirectoryKey, .isRegularFileKey, .isSymbolicLinkKey]
    guard let enumerator = fileManager.enumerator(at: payload, includingPropertiesForKeys: keys) else {
        try fail("Không đọc được gói update.")
    }
    var files: [URL] = []
    for case let source as URL in enumerator {
        let values = try source.resourceValues(forKeys: Set(keys))
        if values.isSymbolicLink == true { try fail("Gói update chứa symbolic link không an toàn.") }
        if values.isRegularFile == true { files.append(source) }
    }
    files.sort { left, right in
        if left.lastPathComponent == "manifest.json" { return false }
        if right.lastPathComponent == "manifest.json" { return true }
        return left.path < right.path
    }
    let payloadPath = payload.standardizedFileURL.path.hasSuffix("/")
        ? payload.standardizedFileURL.path : payload.standardizedFileURL.path + "/"
    let extensionPath = extensionRoot.standardizedFileURL.path.hasSuffix("/")
        ? extensionRoot.standardizedFileURL.path : extensionRoot.standardizedFileURL.path + "/"
    for source in files {
        guard source.standardizedFileURL.path.hasPrefix(payloadPath) else { try fail("Đường dẫn nguồn không an toàn.") }
        let relative = String(source.standardizedFileURL.path.dropFirst(payloadPath.count))
        let destination = extensionRoot.appendingPathComponent(relative).standardizedFileURL
        guard destination.path == extensionRoot.standardizedFileURL.path || destination.path.hasPrefix(extensionPath) else {
            try fail("Đường dẫn đích không an toàn.")
        }
        try fileManager.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        if fileManager.fileExists(atPath: destination.path) { try fileManager.removeItem(at: destination) }
        try fileManager.copyItem(at: source, to: destination)
    }
}

private func update(_ config: [String: Any]) throws -> [String: Any] {
    let fileManager = FileManager.default
    let extensionRoot = URL(fileURLWithPath: try text(config, "extensionPath"), isDirectory: true)
        .standardizedFileURL.resolvingSymlinksInPath()
    guard fileManager.fileExists(atPath: extensionRoot.path) else { try fail("Không tìm thấy thư mục extension.") }
    let currentManifestData = try Data(contentsOf: extensionRoot.appendingPathComponent("manifest.json"))
    let currentManifest = try dictionary(try JSONSerialization.jsonObject(with: currentManifestData), "Manifest hiện tại không hợp lệ.")
    guard try text(currentManifest, "name") == "NOTA Labeling Organizer" else { try fail("Sai thư mục extension.") }
    let currentVersion = try text(currentManifest, "version")

    let releaseData = try fetch(try text(config, "releaseApi"))
    let release = try dictionary(try JSONSerialization.jsonObject(with: releaseData), "GitHub Release không hợp lệ.")
    let latestVersion = try text(release, "tag_name").replacingOccurrences(of: "^[vV]", with: "", options: .regularExpression)
    if compareVersions(latestVersion, currentVersion) <= 0 {
        return ["ok": true, "status": "up_to_date", "version": currentVersion]
    }

    guard let assets = release["assets"] as? [[String: Any]],
          let asset = assets.first(where: { (($0["name"] as? String) ?? "").lowercased().hasSuffix(".zip") }) else {
        try fail("Release không có gói ZIP extension.")
    }
    let downloadURL = try text(asset, "browser_download_url")
    guard downloadURL.lowercased().hasPrefix(releasePrefix.lowercased()) else { try fail("Đường dẫn Release không hợp lệ.") }
    let digest = try text(asset, "digest")
    let digestParts = digest.split(separator: ":", maxSplits: 1).map(String.init)
    guard digestParts.count == 2, digestParts[0].lowercased() == "sha256" else { try fail("Định dạng SHA256 không hợp lệ.") }

    let archiveData = try fetch(downloadURL)
    let actualDigest = SHA256.hash(data: archiveData).map { String(format: "%02x", $0) }.joined()
    guard actualDigest.caseInsensitiveCompare(digestParts[1]) == .orderedSame else { try fail("SHA256 của gói update không khớp.") }

    let temporaryRoot = fileManager.temporaryDirectory.appendingPathComponent("NOTA-Labeling-Updater-\(UUID().uuidString)", isDirectory: true)
    let zip = temporaryRoot.appendingPathComponent("extension.zip")
    let payload = temporaryRoot.appendingPathComponent("payload", isDirectory: true)
    try fileManager.createDirectory(at: temporaryRoot, withIntermediateDirectories: true)
    defer { try? fileManager.removeItem(at: temporaryRoot) }
    try archiveData.write(to: zip, options: .atomic)
    try validateZipEntries(zip)
    try fileManager.createDirectory(at: payload, withIntermediateDirectories: true)
    _ = try runProcess("/usr/bin/ditto", ["-x", "-k", zip.path, payload.path])
    try validatePayload(payload, expectedVersion: latestVersion)
    try copyPayload(payload, to: extensionRoot)
    return ["ok": true, "status": "updated", "version": latestVersion]
}

private func readMessage() throws -> [String: Any] {
    let input = FileHandle.standardInput
    let header = input.readData(ofLength: 4)
    guard header.count == 4 else { try fail("Message bị thiếu phần đầu.") }
    let bytes = [UInt8](header)
    let length = Int(UInt32(bytes[0]) | UInt32(bytes[1]) << 8 | UInt32(bytes[2]) << 16 | UInt32(bytes[3]) << 24)
    guard length > 0, length <= 1_048_576 else { try fail("Kích thước message không hợp lệ.") }
    var body = Data()
    while body.count < length {
        let chunk = input.readData(ofLength: length - body.count)
        guard !chunk.isEmpty else { try fail("Message bị thiếu dữ liệu.") }
        body.append(chunk)
    }
    return try dictionary(try JSONSerialization.jsonObject(with: body), "JSON không hợp lệ.")
}

private func send(_ response: [String: Any]) {
    guard let body = try? JSONSerialization.data(withJSONObject: response) else { return }
    var length = UInt32(body.count).littleEndian
    var output = Data(bytes: &length, count: 4)
    output.append(body)
    try? FileHandle.standardOutput.write(contentsOf: output)
}

do {
    let request = try readMessage()
    let executable = URL(fileURLWithPath: CommandLine.arguments[0]).standardizedFileURL.resolvingSymlinksInPath()
    let configData = try Data(contentsOf: executable.deletingLastPathComponent().appendingPathComponent("config.json"))
    let config = try dictionary(try JSONSerialization.jsonObject(with: configData), "Config updater không hợp lệ.")
    let callerOrigin = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ""
    guard let origins = config["allowedOrigins"] as? [String], origins.contains(where: { $0.caseInsensitiveCompare(callerOrigin) == .orderedSame }) else {
        try fail("Nguồn gọi updater không hợp lệ.")
    }
    let action = try text(request, "action")
    if action == "ping" {
        send(["ok": true, "status": "ready", "host": hostName])
    } else if action == "update" {
        send(try update(config))
    } else {
        try fail("Yêu cầu updater không hợp lệ.")
    }
} catch {
    send(["ok": false, "status": "error", "message": error.localizedDescription])
}
