(function () {
 'use strict';
 var params = new URLSearchParams(location.search), run = params.get('run') || '';
 var video = document.getElementById('video'), view = 'launcher', current = null, deadline = null, requestedAt = 0, lastProgress = 0, lastTime = 0, lastReport = 0, events = [], reportPending = null, sourceSequence = 0;
 var base = location.origin, reportedPlaying = false, lastActivation = -1000;
 var hls = null, hlsLoading = null, compatFatal = false;
 var bookmarkKey='freestyle-lite.bookmarks.v1',bookmarks={items:[],undo:null},bookmarkEditing=null,bookmarkHasStored=false,bookmarkLoadFailed=false;
 function avplayAvailable() { try { return !!(window.webapis && window.webapis.avplay); } catch (e) { return false; } }
 function errorInfo() { return video.error ? {code:video.error.code, message:String(video.error.message || '').replace(/https?:\/\/[^\s)]+/g, '[address]').slice(0,220)} : null; }
 function el(id) { return document.getElementById(id); }
 function media(name) { return base + '/player-media/' + name + '?run=' + encodeURIComponent(run); }
 function nativeSupport() { return video.canPlayType('application/vnd.apple.mpegurl') || video.canPlayType('application/x-mpegURL'); }
 function log(name, detail) {
  events.push({name:name, mode:current ? current.kind : null, ms:Math.round(performance.now()), detail:detail || null}); if (events.length > 20) events.shift();
  queueReport();
 }
 function queueReport() { if (reportPending !== null) return; reportPending = setTimeout(function () { reportPending = null; report(); }, 250); }
 function report() {
  if (!run) return;
  var request = new XMLHttpRequest(); request.open('POST', '/telemetry?run=' + encodeURIComponent(run), true);
  request.setRequestHeader('Content-Type', 'application/json');
  request.send(JSON.stringify({phase:'tv-browser', version:'0.4.0', userAgent:navigator.userAgent, view:view, mode:current ? current.kind : null, nativeHls:nativeSupport(), hlsVersion:window.Hls ? Hls.version : null, avplayAvailable:avplayAvailable(), portalAvailable:!!window.TizenPortal, hidden:document.hidden, focused:document.activeElement ? document.activeElement.id : '', video:{readyState:video.readyState, networkState:video.networkState, paused:video.paused, currentTime:Math.round(video.currentTime * 10) / 10, error:errorInfo()}, events:events.slice()}));
 }
 function notice(message) { el('notice').textContent = message; el('notice').hidden = !message; }
 function setView(next, focus) {
  view = next; ['launcher','direct','player-view','bookmark-editor'].forEach(function (id) { el(id).hidden = id !== next; });
  notice(''); if (focus) el(focus).focus(); log('view', next);
 }
 function release() {
  sourceSequence++; clearTimeout(deadline); deadline = null; if (hls) { hls.destroy(); hls = null; } compatFatal = false; video.pause(); video.removeAttribute('src'); video.load(); current = null; reportedPlaying = false;
 }
 function homeFocus(){var first=el('bookmark-list').querySelector('button');return first?first.id:'bookmark-add';}
 function home() { release();el('diagnostics').hidden=true;setView('launcher',homeFocus()); }
 function safeUrl(value) {
  var text = String(value || '').trim();
  if (!/^[a-z][a-z\d+.-]*:/i.test(text)) text = 'https://' + text;
  var parsed = new URL(text); if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) throw Error('http 또는 https 주소를 입력해 주세요.'); return parsed.href;
 }
 function cleanBookmark(item){
  if(!item||typeof item.id!=='string'||!/^[a-z0-9-]{1,96}$/i.test(item.id)||typeof item.url!=='string'||item.url.length>2048)return null;
  try{var url=safeUrl(item.url);return {id:item.id,url:url,name:String(item.name||new URL(url).hostname).trim().slice(0,60)||new URL(url).hostname};}catch(e){return null;}
 }
 function readBookmarks(){
  try{var raw=localStorage.getItem(bookmarkKey);bookmarkHasStored=raw!==null;if(raw===null)return;var data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.items))throw Error('format');var seen={},ids={};bookmarks.items=data.items.slice(0,40).map(cleanBookmark).filter(function(item){if(!item||seen[item.url]||ids[item.id])return false;seen[item.url]=true;ids[item.id]=true;return true;});if(data.undo&&typeof data.undo.index==='number'){var removed=cleanBookmark(data.undo.item);if(removed)bookmarks.undo={item:removed,index:Math.max(0,Math.min(40,Math.floor(data.undo.index)))};}}catch(e){bookmarkHasStored=true;bookmarkLoadFailed=true;}
 }
 function commitBookmarks(next){
  try{localStorage.setItem(bookmarkKey,JSON.stringify({version:1,items:next.items,undo:next.undo||null}));bookmarks=next;bookmarkHasStored=true;bookmarkLoadFailed=false;renderBookmarks();return true;}catch(e){notice('주소를 저장하지 못했어요. 저장 공간과 앱 설정을 확인해 주세요.');return false;}
 }
 function renderBookmarks(){
  var list=el('bookmark-list');list.textContent='';el('bookmark-empty').hidden=bookmarks.items.length>0;el('bookmark-undo').hidden=!bookmarks.undo;
  bookmarks.items.forEach(function(item,index){
   var row=document.createElement('div'),open=document.createElement('button'),name=document.createElement('strong'),host=document.createElement('small'),edit=document.createElement('button');row.className='bookmark-row';open.id='bookmark-open-'+index;open.className='bookmark-open';name.textContent=item.name;host.textContent=new URL(item.url).hostname;open.appendChild(name);open.appendChild(host);open.onclick=function(){openWebsite(item.url,item.name);};edit.id='bookmark-edit-'+index;edit.textContent='수정';edit.setAttribute('aria-label',item.name+' 수정');edit.onclick=function(){editBookmark(item.id);};row.appendChild(open);row.appendChild(edit);list.appendChild(row);
  });
 }
 function editBookmark(id){
  var item=bookmarks.items.filter(function(entry){return entry.id===id;})[0]||null;bookmarkEditing=item?item.id:null;el('bookmark-editor-title').textContent=item?'즐겨찾기 수정':'즐겨찾기 추가';el('bookmark-name').value=item?item.name:'';el('bookmark-url').value=item?item.url:el('web-url').value;el('bookmark-delete').hidden=!item;setView('bookmark-editor',item?'bookmark-save':'bookmark-name');
 }
 readBookmarks();renderBookmarks();
 el('bookmark-add').onclick=function(){editBookmark(null);};el('bookmark-cancel').onclick=home;
 el('bookmark-form').onsubmit=function(e){
  e.preventDefault();try{
   if(!el('bookmark-url').value.trim())throw Error('저장할 주소를 입력해 주세요.');var url=safeUrl(el('bookmark-url').value);if(url.length>2048)throw Error('주소가 너무 길어요. 사이트의 기본 주소를 입력해 주세요.');var name=el('bookmark-name').value.trim().slice(0,60)||new URL(url).hostname;
   var index=bookmarks.items.findIndex(function(item){return item.id===bookmarkEditing;}),duplicate=bookmarks.items.findIndex(function(item){return item.url===url;});if(index>=0&&duplicate>=0&&index!==duplicate)throw Error('이미 저장한 주소예요. 기존 즐겨찾기를 수정해 주세요.');if(index<0)index=duplicate;
   var items=bookmarks.items.slice();if(index<0){if(items.length>=40)throw Error('주소는 40개까지 저장할 수 있어요.');items.push({id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),name:name,url:url});}else items[index]={id:items[index].id,name:name,url:url};
   if(commitBookmarks({items:items,undo:bookmarks.undo})){home();notice('즐겨찾기에 저장했어요.');log('bookmark-saved',{count:items.length});}
  }catch(error){notice(error.message);}
 };
 el('bookmark-delete').onclick=function(){var index=bookmarks.items.findIndex(function(item){return item.id===bookmarkEditing;});if(index<0)return;var items=bookmarks.items.slice(),removed=items.splice(index,1)[0];if(commitBookmarks({items:items,undo:{item:removed,index:index}})){home();notice('주소를 삭제했어요. 되돌리기로 복원할 수 있어요.');log('bookmark-deleted',{count:items.length});}};
 el('bookmark-undo').onclick=function(){if(!bookmarks.undo)return;var items=bookmarks.items.slice(),undo=bookmarks.undo;if(items.some(function(item){return item.url===undo.item.url;})){notice('같은 주소가 이미 저장되어 있어요.');return;}if(items.length>=40){notice('복원하려면 주소 하나를 먼저 삭제해 주세요.');return;}items.splice(Math.min(undo.index,items.length),0,undo.item);if(commitBookmarks({items:items,undo:null})){el(homeFocus()).focus();notice('삭제한 주소를 복원했어요.');log('bookmark-restored',{count:items.length});}};
 el('show-tests').onclick=function(){el('diagnostics').hidden=!el('diagnostics').hidden;if(!el('diagnostics').hidden)el('sample-compat').focus();};
 function clock(value) { if (!isFinite(value) || value < 0) return '0:00'; var n = Math.floor(value); return Math.floor(n / 60) + ':' + ('0' + n % 60).slice(-2); }
 function update() { el('clock').textContent = clock(video.currentTime) + ' / ' + clock(video.duration); el('toggle').textContent = video.paused ? '재생' : '일시정지'; }
 function fail(message) {
  if (!current) return; clearTimeout(deadline); deadline = null; video.pause();
  el('playback-state').textContent = '재생 확인 필요'; el('player-error').textContent = message;
  el('error-panel').hidden = false; el('fallback').hidden = !current.fallback;
  el('compat-fallback').hidden = current.kind.indexOf('compat') >= 0 || !/\.m3u8(?:[?#]|$)/i.test(current.url);
  el('retry').focus(); log('playback-failed', errorInfo());
 }
 function armDeadline() { clearTimeout(deadline); deadline = setTimeout(function () { fail('15초 동안 영상이 진행되지 않았어요. 다시 시도하거나 다른 재생 방식을 선택해 주세요.'); }, 15000); }
 function play() {
  if (!current) return;
  var activeSource = sourceSequence;
  el('error-panel').hidden = true; requestedAt = performance.now(); lastProgress = requestedAt; lastTime = video.currentTime; reportedPlaying = false;
  el('playback-state').textContent = '불러오는 중'; armDeadline(); log('play-request');
  try { var p = video.play(); if (p && p.catch) p.catch(function (e) { if (!current || activeSource !== sourceSequence || e.name === 'AbortError') return; fail(e.name === 'NotAllowedError' ? '리모컨으로 재생 버튼을 다시 눌러 주세요.' : '이 주소를 내장 플레이어에서 재생하지 못했어요. 주소와 영상 형식을 확인해 주세요.'); }); }
  catch (e) { fail('재생을 시작하지 못했어요. 다시 시도해 주세요.'); }
 }
 function loadHlsLibrary() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (hlsLoading) return hlsLoading;
  hlsLoading = new Promise(function (resolve, reject) {
   var script = document.createElement('script'); script.src = base + '/player-assets/hls-compat.min.js?run=' + encodeURIComponent(run);
   script.onload = function () { if (window.Hls) resolve(window.Hls); else { hlsLoading = null; reject(Error('library unavailable')); } };
   script.onerror = function () { hlsLoading = null; script.remove(); reject(Error('library load failed')); };
   document.head.appendChild(script);
  }); return hlsLoading;
 }
 function openVideo(url, title, kind, fallback) {
  release(); current = {url:url, title:title, kind:kind, fallback:fallback || null};
  setView('player-view', 'toggle'); el('player-title').textContent = title; el('error-panel').hidden = true; el('playback-state').textContent = '불러오는 중';
  video.preload = 'auto'; log('source-selected', {kind:kind});
  if (kind.indexOf('compat') < 0) { video.src = url; video.load(); play(); return; }
  var activeSource = sourceSequence; armDeadline();
  loadHlsLibrary().then(function (Library) {
   if (!current || activeSource !== sourceSequence) return;
   log('hls-library-ready', {version:Library.version, supported:Library.isSupported()});
   if (!Library.isSupported()) { fail('이 환경에서는 호환 재생 방식을 지원하지 않아요.'); return; }
   hls = new Library({enableWorker:false, maxBufferLength:15, maxMaxBufferLength:30, backBufferLength:5});
   hls.on(Library.Events.ERROR, function (_, data) {
    if (!current || activeSource !== sourceSequence) return;
    log('hls-error', {type:data.type, details:data.details, fatal:data.fatal, status:data.response ? data.response.code : null});
    if (data.fatal) { compatFatal = true; fail('호환 재생을 준비하지 못했어요. 오류 정보를 기록했습니다.'); }
   });
   hls.on(Library.Events.MANIFEST_PARSED, function () { if (current && activeSource === sourceSequence) play(); });
   hls.loadSource(url); hls.attachMedia(video);
  }).catch(function () { if (current && activeSource === sourceSequence) fail('호환 재생 파일을 불러오지 못했어요. 다시 시도해 주세요.'); });
 }
 el('home').onclick = home; el('player-back').onclick = home; el('direct-back').onclick = home; el('error-close').onclick = home;
 el('refresh').onclick = function () { location.reload(); };
 el('sample-hls').onclick = function () { openVideo(media('test.m3u8'), '내장 HLS 재생', 'sample-native-hls', media('test.mp4')); };
 el('sample-mp4').onclick = function () { openVideo(media('test.mp4'), '기본 MP4 재생', 'sample-mp4'); };
 el('sample-compat').onclick = function () { openVideo(media('test.m3u8'), '호환 HLS 재생', 'sample-compat-hls', media('test.mp4')); };
 el('show-direct').onclick = function () { setView('direct', 'video-url'); };
 function openWebsite(value, name) { var url = safeUrl(value);if(new URL(url).origin!==base&&(!window.TizenPortal||!window.freestyleSiteTools||!window.freestyleSitePlayer||(window.freestyleModule&&!window.freestyleModule.ready))){notice('사이트 차단·재생 기능이 아직 준비되지 않았어요. 잠시 후 다시 눌러 주세요.');log('site-protection-not-ready');return;}release(); log('website-open'); if (window.TizenPortal && window.freestyleSiteTools) { notice('사이트 보호 설정을 준비하고 있어요.');var move=window.freestyleSiteTools.navigate(url, name);if(move&&move.catch)move.catch(function(error){notice(error.message==='decompression-unavailable'?'이 실행 환경에서는 보호 설정 전달을 지원하지 않아 이동을 멈췄어요.':'사이트 보호 설정을 준비하지 못해 이동을 멈췄어요. 새로고침 후 다시 시도해 주세요.');log('site-protection-prepare-failed');}); } else location.assign(url); }
 el('web-form').onsubmit = function (e) { e.preventDefault(); try { if (!el('web-url').value.trim()) throw Error('웹사이트 주소를 입력해 주세요.'); openWebsite(el('web-url').value, '웹사이트'); } catch (err) { notice(err.message); } };
 el('browser-check').onclick = function () { openWebsite(base + '/tv/browser-check?run=' + encodeURIComponent(run), '브라우저 기능 확인'); };
 var settingsRequest = new XMLHttpRequest(); settingsRequest.open('GET', '/tv/settings?run=' + encodeURIComponent(run), true);
 settingsRequest.onload = function () { try { if (settingsRequest.status !== 200) return; var settings = JSON.parse(settingsRequest.responseText), site = settings.preferredSite; if (!site) return; var target = safeUrl(site.url); el('open-saved-site').textContent = site.label || '저장한 사이트 열기';el('open-saved-site').onclick = function () { openWebsite(target, '영상 사이트'); };if(!bookmarkHasStored){var seed={id:'preferred-site',name:String(site.label||'영상 사이트').replace(/\s*열기$/,'').slice(0,60),url:target};var wasAdd=document.activeElement===el('bookmark-add');if(!commitBookmarks({items:[seed],undo:null})){el('open-saved-site').hidden=false;}else if(view==='launcher'&&wasAdd)el(homeFocus()).focus();}else if(bookmarkLoadFailed)el('open-saved-site').hidden=false; } catch (ignored) {} }; settingsRequest.send();
 el('video-form').onsubmit = function (e) { e.preventDefault(); try { if (!el('video-url').value.trim()) throw Error('영상 주소를 입력해 주세요.'); var url = safeUrl(el('video-url').value); openVideo(url, '직접 입력한 영상', /\.m3u8(?:[?#]|$)/i.test(url) ? 'custom-compat-hls' : 'custom-media'); } catch (err) { notice(err.message); } };
 el('toggle').onclick = function () { if (video.paused) play(); else { clearTimeout(deadline); video.pause(); } };
 el('retry').onclick = function () { if (!current) return; if (current.kind.indexOf('compat') >= 0) { if (compatFatal || !hls) openVideo(current.url, current.title, current.kind, current.fallback); else play(); } else { video.load(); play(); } };
 el('compat-fallback').onclick = function () { if (current) openVideo(current.url, '호환 HLS 재생', current.kind.indexOf('sample') === 0 ? 'sample-compat-hls' : 'custom-compat-hls', current.fallback); };
 el('fallback').onclick = function () { if (current && current.fallback) openVideo(current.fallback, '기본 MP4 비교 재생', 'sample-mp4-fallback'); };
 function seek(delta) { if (current && isFinite(video.duration) && video.duration > 0) { video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + delta)); if (!video.paused) armDeadline(); log('seek', {seconds:delta}); } }
 el('rewind').onclick = function () { seek(-10); }; el('forward').onclick = function () { seek(10); };
 el('fullscreen').onclick = function () { var fn = video.requestFullscreen || video.webkitRequestFullscreen; if (!fn) return notice('이 환경은 영상 전체 화면 전환을 지원하지 않아요.'); try { var p = fn.call(video); if (p && p.catch) p.catch(function () { notice('전체 화면 전환을 시작하지 못했어요.'); }); } catch (e) { notice('전체 화면 전환을 시작하지 못했어요.'); } };
 ['loadedmetadata','canplay','playing','waiting','stalled','pause','ended','error'].forEach(function (name) {
  video.addEventListener(name, function () {
   if (!current) return;
   if (name === 'error') { fail('영상 준비 중 오류가 났어요. 오류 코드: ' + (video.error ? video.error.code : '?')); return; }
   if (name === 'playing') { el('error-panel').hidden = true; el('playback-state').textContent = '재생 중'; armDeadline(); if (!reportedPlaying) { reportedPlaying = true; log('first-playing', {elapsedMs:Math.round(performance.now() - requestedAt)}); } }
   if (name === 'waiting' || name === 'stalled') { el('playback-state').textContent = '불러오는 중'; if (!video.paused) armDeadline(); }
   if (name === 'pause') { clearTimeout(deadline); if (el('error-panel').hidden) el('playback-state').textContent = '일시정지'; }
   if (name === 'ended') { clearTimeout(deadline); el('playback-state').textContent = '재생 완료'; log('playback-complete'); }
   update(); log('media:' + name);
  });
 });
 video.addEventListener('timeupdate', function () {
  update(); if (Math.abs(video.currentTime - lastTime) > .1) { lastTime = video.currentTime; lastProgress = performance.now(); if (!video.paused) armDeadline(); }
  if (performance.now() - lastReport > 2000) { lastReport = performance.now(); queueReport(); }
 });
 document.addEventListener('visibilitychange', function () { if (document.hidden) { video.pause(); clearTimeout(deadline); } log('visibility'); });
 window.addEventListener('pagehide', function () { if(window.__freestyleLastTransport&&navigator.sendBeacon)navigator.sendBeacon('/telemetry?run='+encodeURIComponent(run),new Blob([JSON.stringify({phase:'tv-navigation',version:'0.4.0',userAgent:navigator.userAgent,transport:window.__freestyleLastTransport})],{type:'application/json'}));clearTimeout(reportPending); reportPending = null; release(); });
 window.addEventListener('pageshow', function (e) { if (e.persisted) { if (view === 'player-view' && !current) setView('launcher',homeFocus()); else queueReport(); } });
 function focusables() { return Array.prototype.filter.call(document.querySelectorAll('button,input'), function (node) { return !node.disabled && node.getClientRects().length && (!el('error-panel').hidden ? el('error-panel').contains(node) : true); }); }
 function move(key) {
  var nodes = focusables(), active = document.activeElement, rect = active && active.getBoundingClientRect(), best = null, bestScore = Infinity;
  if (!rect || nodes.indexOf(active) < 0) { if (nodes[0]) nodes[0].focus(); return; }
  var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  nodes.forEach(function (node) {
   if (node === active) return; var r = node.getBoundingClientRect(), dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
   var along = key === 37 ? -dx : key === 39 ? dx : key === 38 ? -dy : dy, cross = key === 37 || key === 39 ? Math.abs(dy) : Math.abs(dx);
   if (along <= 2) return; var score = along + cross * 3; if (score < bestScore) { best = node; bestScore = score; }
  }); if (best) best.focus();
 }
 // This app owns its controls. Capture at window before the host shell's
 // document handler, so the same Enter does not also synthesize another click.
 window.addEventListener('keydown', function (e) {
  if (e.defaultPrevented) return;
  var k = e.keyCode || e.which, input = document.activeElement && document.activeElement.tagName === 'INPUT';
  if (k === 10009 || k === 27 || k === 8 && !input) { e.preventDefault(); e.stopImmediatePropagation(); if (input) { document.activeElement.blur(); return; } if (view !== 'launcher') home(); else if (history.length > 1) history.back(); return; }
  if (input) {var ime=window.TizenPortal&&TizenPortal.input&&TizenPortal.input.isIMEActive&&TizenPortal.input.isIMEActive();if(!ime&&(k===38||k===40)){e.preventDefault();e.stopImmediatePropagation();if(view==='bookmark-editor'){var field=document.activeElement.id;el(k===40?(field==='bookmark-name'?'bookmark-url':'bookmark-save'):(field==='bookmark-url'?'bookmark-name':'home')).focus();}else move(k);}return;}
  if (k >= 37 && k <= 40) { e.preventDefault(); e.stopImmediatePropagation(); move(k); }
  else if (k === 13 && document.activeElement && document.activeElement.tagName === 'BUTTON') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) document.activeElement.click(); }
  else if (view === 'player-view' && (k === 10252 || k === 415 || k === 19)) { e.preventDefault(); e.stopImmediatePropagation(); if (e.repeat) return; if (k === 19) video.pause(); else if (k === 415) play(); else el('toggle').click(); }
  else if (view === 'player-view' && (k === 417 || k === 412)) { e.preventDefault(); e.stopImmediatePropagation(); seek(k === 417 ? 10 : -10); }
 }, true);
 document.addEventListener('click', function (e) {
  var button = e.target && e.target.closest ? e.target.closest('button') : null;
  if (!button) return; var now = performance.now();
  if (now - lastActivation < 180) { e.preventDefault(); e.stopImmediatePropagation(); log('duplicate-click-suppressed', {button:button.id}); return; }
  lastActivation = now; log('button-click', {button:button.id, trusted:e.isTrusted});
 }, true);
 var originalPause = video.pause;
 video.pause = function () {
  if (current && !video.paused) {
   var stack = String(new Error().stack || '').replace(/https?:\/\/[^\s)]+/g, function (url) { return url.indexOf('app.js') >= 0 ? '[app.js]' : url.indexOf('tizenportal') >= 0 ? '[TizenPortal]' : '[script]'; }).split('\n').slice(1,5).join('\n');
   log('pause-call', {stack:stack});
  }
  return originalPause.call(video);
 };
 try { if (window.tizen && tizen.tvinputdevice) ['MediaPlayPause','MediaPlay','MediaPause','MediaFastForward','MediaRewind'].forEach(function (key) { tizen.tvinputdevice.registerKey(key); }); } catch (e) {}
 el(homeFocus()).focus(); log('app-ready', {nativeHls:nativeSupport(), videoElementCount:document.querySelectorAll('video').length,sitePlayerAvailable:!!window.freestyleSitePlayer,decompressionAvailable:typeof window.DecompressionStream==='function'});if(bookmarkLoadFailed)notice('저장한 주소를 읽지 못했어요. 기존 저장 정보는 그대로 두었습니다.');
 var resultParam=params.get('site-result');
 if(resultParam&&resultParam.length<8192){
  try{
   var returned=JSON.parse(decodeURIComponent(escape(atob(resultParam))));
   if(returned.phase==='tv-site-playback'){
    function limitedState(state){if(!state||typeof state!=='object')return null;var clean={};['ready','network','time','buffered','levels','cap','status'].forEach(function(key){if(typeof state[key]==='number'&&isFinite(state[key]))clean[key]=state[key];});['paused','fatal'].forEach(function(key){if(typeof state[key]==='boolean')clean[key]=state[key];});['type','details','name'].forEach(function(key){if(typeof state[key]==='string')clean[key]=state[key].replace(/[^a-zA-Z0-9_-]/g,'').slice(0,70);});if(state.error&&[1,2,3,4].indexOf(state.error.code)>=0)clean.error={code:state.error.code};return clean;}
    var result={phase:'tv-site-playback',version:/^0[.]\d+[.]\d+$/.test(returned.version||'')?returned.version:'unknown',appVersion:'0.4.0',userAgent:navigator.userAgent,sourceFound:returned.sourceFound===true,hlsVersion:/^\d+\.\d+\.\d+$/.test(returned.hlsVersion||'')?returned.hlsVersion:null,video:limitedState(returned.video),events:Array.isArray(returned.events)?returned.events.slice(-12).map(function(entry){return {name:String(entry.name||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,70),data:limitedState(entry.data)};}):[]};
    var resultRequest=new XMLHttpRequest();resultRequest.open('POST','/telemetry?run='+encodeURIComponent(run),true);resultRequest.setRequestHeader('Content-Type','application/json');if(!window.freestyleModule)resultRequest.send(JSON.stringify(result));notice('홈으로 돌아왔어요.');
   }
  }catch(ignoredResult){}
  params.delete('site-result');history.replaceState(null,'',location.pathname+'?'+params.toString()+location.hash);
 }
})();
