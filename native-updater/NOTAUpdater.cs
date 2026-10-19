using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

internal static class NOTAUpdater
{
    private const string HostName = "ai.nota.labeling_updater";
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();

    private static void Main(string[] args)
    {
        try
        {
            var request = ReadMessage();
            var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
            var config = ReadObject(File.ReadAllText(configPath, Encoding.UTF8));
            var callerOrigin = args.Length > 0 ? args[0] : "";
            var allowedOrigins = TextList(config, "allowedOrigins");
            if (!allowedOrigins.Exists(origin => String.Equals(origin, callerOrigin, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("Nguồn gọi updater không hợp lệ.");

            var action = Text(request, "action");
            if (action == "ping")
            {
                Send(new Dictionary<string, object> {
                    { "ok", true }, { "status", "ready" }, { "host", HostName }
                });
                return;
            }
            if (action != "update") throw new InvalidOperationException("Yêu cầu updater không hợp lệ.");

            Send(Update(config));
        }
        catch (Exception error)
        {
            Send(new Dictionary<string, object> {
                { "ok", false }, { "status", "error" }, { "message", error.Message }
            });
        }
    }

    private static Dictionary<string, object> Update(Dictionary<string, object> config)
    {
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
        var extensionPath = Path.GetFullPath(Text(config, "extensionPath"));
        var releaseApi = Text(config, "releaseApi");
        if (!Directory.Exists(extensionPath)) throw new DirectoryNotFoundException("Không tìm thấy thư mục extension.");

        var currentManifestPath = Path.Combine(extensionPath, "manifest.json");
        var currentManifest = ReadObject(File.ReadAllText(currentManifestPath, Encoding.UTF8));
        var currentVersion = Text(currentManifest, "version");

        Dictionary<string, object> release;
        using (var client = GitHubClient()) release = ReadObject(client.DownloadString(releaseApi));
        var latestVersion = Text(release, "tag_name").TrimStart('v', 'V');
        if (CompareVersions(latestVersion, currentVersion) <= 0)
        {
            return new Dictionary<string, object> {
                { "ok", true }, { "status", "up_to_date" }, { "version", currentVersion }
            };
        }

        var asset = FindZipAsset(release);
        var downloadUrl = Text(asset, "browser_download_url");
        if (!downloadUrl.StartsWith("https://github.com/tanmainhat0502/dms_annotation_extension/releases/download/", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Đường dẫn Release không hợp lệ.");

        var temporaryRoot = Path.Combine(Path.GetTempPath(), "NOTA-Labeling-Updater-" + Guid.NewGuid().ToString("N"));
        var zipPath = Path.Combine(temporaryRoot, "extension.zip");
        var extractPath = Path.Combine(temporaryRoot, "payload");
        Directory.CreateDirectory(temporaryRoot);
        try
        {
            using (var client = GitHubClient()) client.DownloadFile(downloadUrl, zipPath);
            VerifyDigest(zipPath, TextOrEmpty(asset, "digest"));
            ExtractVerified(zipPath, extractPath);
            ValidatePayload(extractPath, latestVersion);
            CopyPayload(extractPath, extensionPath);
        }
        finally
        {
            try { if (Directory.Exists(temporaryRoot)) Directory.Delete(temporaryRoot, true); } catch { }
        }

        return new Dictionary<string, object> {
            { "ok", true }, { "status", "updated" }, { "version", latestVersion }
        };
    }

    private static WebClient GitHubClient()
    {
        var client = new WebClient();
        client.Encoding = Encoding.UTF8;
        client.Headers[HttpRequestHeader.UserAgent] = "NOTA-Labeling-Updater";
        client.Headers[HttpRequestHeader.Accept] = "application/vnd.github+json";
        return client;
    }

    private static Dictionary<string, object> FindZipAsset(Dictionary<string, object> release)
    {
        object value;
        if (!release.TryGetValue("assets", out value) || !(value is IEnumerable))
            throw new InvalidOperationException("Release không có danh sách file.");
        foreach (var item in (IEnumerable)value)
        {
            var asset = item as Dictionary<string, object>;
            if (asset != null && Text(asset, "name").EndsWith(".zip", StringComparison.OrdinalIgnoreCase)) return asset;
        }
        throw new InvalidOperationException("Release không có gói ZIP extension.");
    }

    private static void VerifyDigest(string path, string digest)
    {
        if (String.IsNullOrWhiteSpace(digest)) throw new InvalidOperationException("Release chưa có SHA256.");
        var parts = digest.Split(new[] { ':' }, 2);
        if (parts.Length != 2 || !parts[0].Equals("sha256", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Định dạng SHA256 không hợp lệ.");
        string actual;
        using (var stream = File.OpenRead(path))
        using (var sha = SHA256.Create()) actual = BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
        if (!actual.Equals(parts[1], StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("SHA256 của gói update không khớp.");
    }

    private static void ExtractVerified(string zipPath, string destination)
    {
        Directory.CreateDirectory(destination);
        var root = Path.GetFullPath(destination).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        using (var archive = ZipFile.OpenRead(zipPath))
        {
            foreach (var entry in archive.Entries)
            {
                var target = Path.GetFullPath(Path.Combine(destination, entry.FullName));
                if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("Gói update chứa đường dẫn không an toàn.");
            }
        }
        ZipFile.ExtractToDirectory(zipPath, destination);
    }

    private static void ValidatePayload(string payload, string expectedVersion)
    {
        foreach (var required in new[] { "manifest.json", "content.js", "popup.html", "popup.js" })
            if (!File.Exists(Path.Combine(payload, required))) throw new InvalidOperationException("Gói update thiếu " + required + ".");
        var manifest = ReadObject(File.ReadAllText(Path.Combine(payload, "manifest.json"), Encoding.UTF8));
        if (Text(manifest, "name") != "NOTA Labeling Organizer") throw new InvalidOperationException("Sai extension trong gói update.");
        if (Text(manifest, "version") != expectedVersion) throw new InvalidOperationException("Version trong manifest không khớp Release.");
    }

    private static void CopyPayload(string payload, string extensionPath)
    {
        var manifestSource = Path.Combine(payload, "manifest.json");
        foreach (var source in Directory.GetFiles(payload, "*", SearchOption.AllDirectories))
        {
            if (source.Equals(manifestSource, StringComparison.OrdinalIgnoreCase)) continue;
            CopyFile(payload, source, extensionPath);
        }
        CopyFile(payload, manifestSource, extensionPath);
    }

    private static void CopyFile(string payload, string source, string extensionPath)
    {
        var relative = source.Substring(Path.GetFullPath(payload).TrimEnd(Path.DirectorySeparatorChar).Length)
            .TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var destination = Path.Combine(extensionPath, relative);
        var directory = Path.GetDirectoryName(destination);
        if (!Directory.Exists(directory)) Directory.CreateDirectory(directory);
        File.Copy(source, destination, true);
    }

    private static int CompareVersions(string left, string right)
    {
        var a = left.Split('.');
        var b = right.Split('.');
        for (var i = 0; i < Math.Max(a.Length, b.Length); i++)
        {
            int x = 0, y = 0;
            if (i < a.Length) Int32.TryParse(a[i], out x);
            if (i < b.Length) Int32.TryParse(b[i], out y);
            if (x != y) return x.CompareTo(y);
        }
        return 0;
    }

    private static Dictionary<string, object> ReadObject(string value)
    {
        var result = Json.DeserializeObject(value) as Dictionary<string, object>;
        if (result == null) throw new InvalidOperationException("JSON không hợp lệ.");
        return result;
    }

    private static string Text(Dictionary<string, object> source, string key)
    {
        var result = TextOrEmpty(source, key);
        if (String.IsNullOrWhiteSpace(result)) throw new InvalidOperationException("Thiếu cấu hình " + key + ".");
        return result;
    }

    private static string TextOrEmpty(Dictionary<string, object> source, string key)
    {
        object value;
        return source.TryGetValue(key, out value) && value != null ? Convert.ToString(value) : "";
    }

    private static List<string> TextList(Dictionary<string, object> source, string key)
    {
        object value;
        if (!source.TryGetValue(key, out value) || !(value is IEnumerable))
            throw new InvalidOperationException("Thiếu cấu hình " + key + ".");
        var result = new List<string>();
        foreach (var item in (IEnumerable)value)
        {
            var text = Convert.ToString(item);
            if (!String.IsNullOrWhiteSpace(text)) result.Add(text);
        }
        if (result.Count == 0) throw new InvalidOperationException("Cấu hình " + key + " đang trống.");
        return result;
    }

    private static Dictionary<string, object> ReadMessage()
    {
        var input = Console.OpenStandardInput();
        var header = ReadExactly(input, 4);
        var length = BitConverter.ToInt32(header, 0);
        if (length <= 0 || length > 1024 * 1024) throw new InvalidOperationException("Kích thước message không hợp lệ.");
        return ReadObject(Encoding.UTF8.GetString(ReadExactly(input, length)));
    }

    private static byte[] ReadExactly(Stream stream, int length)
    {
        var result = new byte[length];
        var offset = 0;
        while (offset < length)
        {
            var count = stream.Read(result, offset, length - offset);
            if (count <= 0) throw new EndOfStreamException("Message bị thiếu dữ liệu.");
            offset += count;
        }
        return result;
    }

    private static void Send(Dictionary<string, object> response)
    {
        try
        {
            var bytes = Encoding.UTF8.GetBytes(Json.Serialize(response));
            var output = Console.OpenStandardOutput();
            var header = BitConverter.GetBytes(bytes.Length);
            output.Write(header, 0, header.Length);
            output.Write(bytes, 0, bytes.Length);
            output.Flush();
        }
        catch { }
    }
}
