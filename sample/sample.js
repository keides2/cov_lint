// server.js
const http = require('http');
const url = require('url');
const fs = require('fs');

http.createServer(function (req, res) {
    const query = url.parse(req.url, true).query;
    const filename = query.file;

    // 任意のファイルを読み取る可能性がある
    fs.readFile(filename, function(err, data) {
        if (err) {
            res.writeHead(404, {'Content-Type': 'text/html'});
            return res.end("404 Not Found");
        }
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write(data);
        return res.end();
    });
}).listen(8080);

console.log('Server running at http://localhost:8080/');
