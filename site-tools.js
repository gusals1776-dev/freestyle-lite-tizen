(function () {
 'use strict';
 // Serialized through TizenPortal's supported globalUserscripts payload.
 // It keeps page content and media URLs on the projector.
 function injectedTools(options) {
  if (window.top !== window || window.__freestyleSiteTools) return;
  window.__freestyleSiteTools = true;
  var blockPopups = true, blocked = 0, originalOpen = window.open, pending = null, observer = null;
  var badge = document.createElement('button'); badge.id = 'freestyle-site-tools'; badge.type = 'button';
  badge.style.cssText = 'position:fixed;left:18px;bottom:18px;z-index:2147483646;background:#162839;color:#e8f7ff;border:2px solid #8dd8ff;border-radius:9px;padding:10px 14px;font:18px sans-serif;cursor:pointer';
  function label() { badge.textContent = '새 창 차단 ' + (blockPopups ? '켜짐' : '꺼짐') + (blocked ? ' · ' + blocked : ''); }
  badge.onclick = function (event) { event.preventDefault(); blockPopups = !blockPopups; label(); };
  label(); (document.body || document.documentElement).appendChild(badge);
  document.documentElement.setAttribute('data-freestyle-tools', 'ready');
  // The host already implements a D-pad mouse with full click dispatch.
  // Enable that supported implementation on external pages.
  if (options && options.pointerMode) {
   try {
    var input = window.TizenPortal && window.TizenPortal.input;
    if (input && typeof input.isPointerMode === 'function' && typeof input.togglePointer === 'function') {
     if (!input.isPointerMode()) input.togglePointer();
     document.documentElement.setAttribute('data-freestyle-pointer', input.isPointerMode() ? 'ready' : 'unavailable');
    }
   } catch (ignoredPointer) {}
  }
  var popupWrapper = function (url, target) {
   if (!blockPopups || target === '_self' || target === '_top' || target === '_parent') return originalOpen.apply(window, arguments);
   blocked++; label(); return null;
  };
  window.open = popupWrapper;
  function anchorClick(event) {
   var link = event.target && event.target.closest ? event.target.closest('a[target="_blank"]') : null;
   if (!blockPopups || !link || link === badge) return;
   // Opening a same-origin content link in this tab preserves navigation.
   try { var u = new URL(link.href, location.href); if (u.origin === location.origin && /^https?:$/.test(u.protocol)) { event.preventDefault(); event.stopImmediatePropagation(); location.assign(u.href); return; } } catch (ignored) {}
   event.preventDefault(); event.stopImmediatePropagation(); blocked++; label();
  }
  function mainVideo() { return document.querySelector('video.player,.plyr__video-wrapper video,video#player,video[data-freestyle-main]'); }
  function pauseExtras(playing) {
   var main = mainVideo(); if (!main) return;
   var videos = document.querySelectorAll('video');
   for (var i = 0; i < videos.length && i < 40; i++) {
    var v = videos[i]; if (v === main) continue;
    if (playing === main || v.autoplay && v.clientWidth > 0 && v.clientWidth <= 240 && v.clientHeight <= 180) { v.pause(); v.autoplay = false; v.preload = 'none'; }
   }
  }
  function onPlay(event) { if (event.target && event.target.tagName === 'VIDEO') pauseExtras(event.target); }
  function schedule() { if (pending !== null) return; pending = setTimeout(function () { pending = null; pauseExtras(null); }, 250); }
  document.addEventListener('click', anchorClick, true); document.addEventListener('play', onPlay, true);
  observer = new MutationObserver(function (records) {
   for (var i = 0; i < records.length; i++) for (var j = 0; j < records[i].addedNodes.length; j++) { var n = records[i].addedNodes[j]; if (n.nodeType === 1 && (n.tagName === 'VIDEO' || n.querySelector && n.querySelector('video'))) { schedule(); return; } }
  });
  observer.observe(document.body || document.documentElement, {childList:true, subtree:true}); schedule();
  if (typeof userscript !== 'undefined') userscript.cleanup = function () { clearTimeout(pending); observer.disconnect(); document.removeEventListener('click', anchorClick, true); document.removeEventListener('play', onPlay, true); if (window.open === popupWrapper) window.open = originalOpen; badge.remove(); document.documentElement.removeAttribute('data-freestyle-tools'); document.documentElement.removeAttribute('data-freestyle-pointer'); delete window.__freestyleSiteTools; };
 }
 function payload(name, pointerMode) {
  var scripts=[{id:'freestyle-site-tools',name:'Freestyle site tools',category:'video',source:'inline',inline:'(' + injectedTools.toString() + ')(' + JSON.stringify({pointerMode:!!pointerMode}) + ');'}];
  if(pointerMode&&window.freestyleSitePlayer){
   var back=new URL('/tv',location.origin);
   var options={returnUrl:back.href,libraryUrl:'https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.js',libraryIntegrity:'sha384-cciJ0zi8d1uMKC2zJd7jvPY4HQt7W4ByUI/FlMkltvBi31aW61rcpVBhpmW8/NwX'};
   scripts.push({id:'freestyle-site-player-030',name:'Freestyle compatible player',category:'video',source:'inline',inline:'('+window.freestyleSitePlayer.toString()+')('+JSON.stringify(options)+');'});
  }
  return {bundleName:'adblock',cardName:name||'웹사이트',focusTransitions:false,gpuHints:false,cssReset:false,userscriptToggles:{'autoplay-blocker':false,'video-autopause':false,'freestyle-site-tools':true,'freestyle-site-player-030':true},globalUserscripts:scripts};
 }
 window.freestyleSiteTools = {
  createPayload:payload,
  navigate:function (url, name) {
   // In the installed module TizenBrew injects helpers on every new page.
   // No PC packing endpoint or large URL payload is needed there.
   if(window.freestyleModule){window.__freestyleLastTransport='module';location.assign(url);return;}
   var target = new URL(url), config = payload(name, target.origin !== location.origin), encoded = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
   // This site's inline script clears location.hash before a late host
   // injection can capture it. Query transport is also supported by Portal.
   // No LAN session credential is included in the transmitted payload.
   if(/^(?:www\.)?missav123\.com$/i.test(target.hostname))return new Promise(function(resolve,reject){
    if(typeof window.DecompressionStream!=='function'){reject(Error('decompression-unavailable'));return;}
    var request=new XMLHttpRequest();request.open('POST','/tv/pack?run='+encodeURIComponent(new URLSearchParams(location.search).get('run')||''),true);request.setRequestHeader('Content-Type','application/json');request.timeout=15000;
    request.onload=function(){try{if(request.status!==200)throw Error('protection-unavailable');var packed=JSON.parse(request.responseText);target.search=(target.search?target.search+'&':'?')+'tp='+packed.encoded+'&fp='+packed.packed;if(target.href.length>8000)throw Error('protection-too-large');window.__freestyleLastTransport='query-compressed';location.assign(target.href);resolve();}catch(e){reject(e);}};
    request.onerror=request.ontimeout=function(){reject(Error('protection-unavailable'));};request.send(JSON.stringify(config));
   });
   target.hash = target.hash ? target.hash.slice(1) + '&tp=' + encoded : 'tp=' + encoded;
   window.__freestyleLastTransport='fragment';
   location.assign(target.href);
  },
  source:injectedTools
 };
})();
