// ES5-compatible service: TizenBrew includes older Node runtimes on some TVs.
// Build inserts a closed map of public UI assets. No filesystem access.
function startFreestyleService(assets, version) {
 'use strict';
 var http=require('http'),port=18769;
 var server=http.createServer(function(req,res){
  var host=String(req.headers.host||'');
  if(!/^(127\.0\.0\.1|localhost):18769$/.test(host)){res.writeHead(403);res.end();return;}
  var path=String(req.url||'').split('?')[0];
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();req.resume();return;}
  if(path==='/tv'){res.writeHead(302,{'Location':'/tv/','Cache-Control':'no-store'});res.end();return;}
  var asset=assets[path];
  if(!Object.prototype.hasOwnProperty.call(assets,path)){res.writeHead(404,{'Cache-Control':'no-store'});res.end();return;}
  var data=asset.data,headers={'Content-Type':asset.type,'Content-Length':data.length,'X-Content-Type-Options':'nosniff','Cache-Control':path.indexOf('/tv/')===0?'no-store':'public, max-age=3600'};
  res.writeHead(200,headers);if(req.method==='HEAD')res.end();else res.end(data);
 });
 server.on('error',function(err){console.error('Freestyle Lite service: '+String(err.code||'start-failed'));});
 server.listen(port,'127.0.0.1');return server;
}
