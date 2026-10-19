ObjC.import("Foundation");

function canonicalPath(value) {
  var path = $(String(value)).stringByStandardizingPath.stringByResolvingSymlinksInPath;
  return ObjC.unwrap(path);
}

function readText(path) {
  var data = $.NSData.dataWithContentsOfFile(path);
  if (!data) return "";
  var text = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding);
  return text ? ObjC.unwrap(text) : "";
}

function run(argv) {
  if (argv.length < 2) return "";
  var target = canonicalPath(argv[0]);
  var found = {};
  for (var index = 1; index < argv.length; index += 1) {
    try {
      var root = JSON.parse(readText(argv[index]));
      var settings = root && root.extensions && root.extensions.settings;
      if (!settings) continue;
      Object.keys(settings).forEach(function (extensionId) {
        var configured = settings[extensionId] && settings[extensionId].path;
        if (configured && canonicalPath(configured) === target && /^[a-p]{32}$/.test(extensionId)) {
          found[extensionId] = true;
        }
      });
    } catch (_) {}
  }
  return Object.keys(found).join("\n");
}
