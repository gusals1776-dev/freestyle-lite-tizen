(function () {
 'use strict';
 // Serialized as a supported TizenPortal userscript. Stream addresses remain
 // inside this page; only categorical playback diagnostics can be returned.
 function sitePlayerTools(options) {
  if (window.top !== window || window.__freestyleSitePlayer) return;
  window.__freestyleSitePlayer = true;
  var bar = document.createElement('div'), status = document.createElement('p'), overlay = null, video = null, controller = null, originalController = null;
  var loadPromise = null, deadline = null, sequence = 0, events = [], sourceFound = false, previousTime = 0, lastClick = 0, savedPointer = false;
  var version = '0.3.1', libraryVersion = null;
  bar.id = 'freestyle-site-player';
  bar.style.cssText = 'position:fixed;top:14px;right:14px;z-index:2147483646;max-width:640px;background:#142333;color:#fff;padding:12px;border:2px solid #8dd8ff;border-radius:10px;font:20px sans-serif';
  function button(text, id, parent, fn) { var b=document.createElement('button'); b.type='button'; b.id=id; b.textContent=text; b.style.cssText='background:#27475f;color:#fff;border:2px solid #8dd8ff;border-radius:8px;font:22px sans-serif;padding:12px 18px;margin:5px;cursor:pointer'; b.onclick=fn; b.onfocus=function(){b.style.outline='4px solid #fff';}; b.onblur=function(){b.style.outline='';}; parent.appendChild(b); return b; }
  var startButton=button('호환 재생','freestyle-compat-open',bar,start);
  button('앱으로 돌아가기','freestyle-return-app',bar,returnToApp);
  status.style.cssText='margin:8px 5px;font:20px sans-serif;line-height:1.5'; bar.appendChild(status); (document.body||document.documentElement).appendChild(bar);
  function message(text){status.textContent=text;}
  function event(name,data){events.push({name:name,data:data||null});if(events.length>12)events.shift();}
  function primary(){return document.querySelector('video.player')||document.querySelector('.plyr__video-wrapper video,video#player');}
  function snapshot(v){return v?{ready:v.readyState,network:v.networkState,paused:v.paused,time:Math.round((v.currentTime||0)*10)/10,error:v.error?{code:v.error.code}:null,buffered:v.buffered?v.buffered.length:0}:null;}
  function clean(value){return String(value||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,70);}
  function statusCode(data){var code=data.response&&data.response.code;if(typeof code==='number'&&isFinite(code))return code;code=data.networkDetails&&data.networkDetails.status;return typeof code==='number'&&isFinite(code)?code:null;}
  function source(){
   var v=primary(),value=window.hls&&window.hls.url;
   if(!value&&v)value=v.currentSrc||v.src;
   try{var url=new URL(value,location.href);if(!/^https?:$/.test(url.protocol)||url.username||url.password||!/\.m3u8$/i.test(url.pathname))return null;return url.href;}catch(e){return null;}
  }
  function loadLibrary(){
   if(loadPromise)return loadPromise;
   loadPromise=new Promise(function(resolve,reject){
    var prior=window.Hls,s=document.createElement('script'),timer;
    s.src=options.libraryUrl;s.integrity=options.libraryIntegrity;s.crossOrigin='anonymous';
    timer=setTimeout(function(){loadPromise=null;reject(Error('library-timeout'));},12000);
    s.onload=function(){clearTimeout(timer);var Library=window.Hls;window.Hls=prior;if(Library&&Library.version==='1.7.3')resolve(Library);else{loadPromise=null;reject(Error('library-version'));}};
    s.onerror=function(){clearTimeout(timer);s.remove();loadPromise=null;reject(Error('library-load'));};document.head.appendChild(s);
   });return loadPromise;
  }
  function arm(){clearTimeout(deadline);deadline=setTimeout(function(){message('15초 동안 영상이 진행되지 않았어요. 상태를 기록했습니다.');event('playback-timeout',snapshot(video));},15000);}
  function play(){if(!video)return;arm();var active=sequence,p=video.play();if(p&&p.catch)p.catch(function(e){if(active!==sequence||e.name==='AbortError')return;clearTimeout(deadline);event('play-rejected',{name:clean(e.name)});message(e.name==='NotAllowedError'?'확인 버튼으로 재생을 다시 눌러 주세요.':'영상 재생을 시작하지 못했어요.');});}
  function close(){
   sequence++;clearTimeout(deadline);if(controller){controller.destroy();controller=null;}
   if(video){video.pause();video.removeAttribute('src');video.load();video=null;}
   if(overlay){overlay.remove();overlay=null;}
   if(originalController&&originalController.startLoad){try{originalController.startLoad(-1);}catch(e){}}originalController=null;
   var input=window.TizenPortal&&window.TizenPortal.input;if(savedPointer&&input&&!input.isPointerMode())input.togglePointer();savedPointer=false;startButton.focus();
  }
  function start(){
   var url=source();sourceFound=!!url;event('original-state',snapshot(primary()));if(!url){message('재생 주소가 준비되지 않았어요. 원본 로딩 후 다시 눌러주세요.');return;}
   if(overlay)close();var active=++sequence;
   var all=document.querySelectorAll('video');for(var i=0;i<all.length&&i<40;i++)all[i].pause();
   originalController=window.hls||null;if(originalController&&originalController.stopLoad){try{originalController.stopLoad();}catch(ignoredStop){}}
   overlay=document.createElement('div');overlay.id='freestyle-compat-player';overlay.style.cssText='position:fixed;inset:0;z-index:2147483645;background:#000;color:#fff;font:24px sans-serif;display:flex;flex-direction:column;justify-content:flex-end';
   video=document.createElement('video');video.playsInline=true;video.preload='auto';video.style.cssText='display:block;width:100%;height:82vh;object-fit:contain;background:#000';overlay.appendChild(video);
   var controls=document.createElement('div');controls.style.cssText='padding:12px;display:flex;justify-content:center;flex-wrap:wrap';overlay.appendChild(controls);
   var toggle=button('재생','freestyle-compat-toggle',controls,function(){if(!video)return;if(video.paused)play();else video.pause();});
   function seek(delta){if(video&&isFinite(video.duration))video.currentTime=Math.max(0,Math.min(video.duration,video.currentTime+delta));}
   button('−10초','freestyle-compat-rewind',controls,function(){seek(-10);});button('＋10초','freestyle-compat-forward',controls,function(){seek(10);});
   button('전체 화면','freestyle-compat-fullscreen',controls,function(){var fn=overlay.requestFullscreen||overlay.webkitRequestFullscreen;if(fn){var p=fn.call(overlay);if(p&&p.catch)p.catch(function(){message('전체 화면 전환을 시작하지 못했어요.');});}});
   button('사이트로 돌아가기','freestyle-compat-close',controls,close);
   (document.body||document.documentElement).appendChild(overlay);
   var input=window.TizenPortal&&window.TizenPortal.input;savedPointer=!!(input&&input.isPointerMode());if(savedPointer)input.togglePointer();
   toggle.focus();message('호환 재생을 준비하고 있어요.');event('compat-request');arm();previousTime=0;
   video.addEventListener('playing',function(){clearTimeout(deadline);message('호환 재생 중');toggle.textContent='일시정지';event('playing',snapshot(video));arm();});
   video.addEventListener('pause',function(){clearTimeout(deadline);toggle.textContent='재생';});
   video.addEventListener('timeupdate',function(){if(video&&Math.abs(video.currentTime-previousTime)>.2){previousTime=video.currentTime;if(!video.paused)arm();}});
   video.addEventListener('ended',function(){clearTimeout(deadline);message('재생 완료');event('ended',snapshot(video));});
   video.addEventListener('error',function(){clearTimeout(deadline);message('호환 영상 오류 '+(video&&video.error?video.error.code:'?'));event('media-error',snapshot(video));});
   loadLibrary().then(function(Library){
    if(active!==sequence||!video)return;libraryVersion=Library.version;
    if(!Library.isSupported()){clearTimeout(deadline);message('이 환경은 호환 재생을 지원하지 않아요.');event('mse-unsupported');return;}
    controller=new Library({enableWorker:false,startLevel:0,maxBufferLength:15,maxMaxBufferLength:30,maxBufferSize:8000000,backBufferLength:5,capLevelToPlayerSize:true});
    controller.on(Library.Events.ERROR,function(_,d){if(active!==sequence)return;var code=statusCode(d);event('compat-hls-error',{type:clean(d.type),details:clean(d.details),fatal:!!d.fatal,status:code});if(d.fatal){clearTimeout(deadline);message('호환 재생 실패: '+clean(d.details)+(code!==null?' ('+code+')':''));}});
    controller.on(Library.Events.MANIFEST_PARSED,function(){if(active!==sequence)return;var cap=-1;controller.levels.forEach(function(level,index){if(level.height&&level.height<=720)cap=index;});if(cap>=0)controller.autoLevelCapping=cap;event('manifest-ready',{levels:controller.levels.length,cap:cap});play();});
    controller.loadSource(url);controller.attachMedia(video);
   }).catch(function(e){if(active!==sequence)return;clearTimeout(deadline);event('library-error',{name:clean(e.message)});message('재생 파일 오류 · 앱으로 돌아가 주세요.');});
  }
  function returnToApp(){
   var data={phase:'tv-site-playback',version:version,hlsVersion:libraryVersion,sourceFound:sourceFound,video:snapshot(video||primary()),events:events};
   var destination=new URL(options.returnUrl);destination.searchParams.set('site-result',btoa(unescape(encodeURIComponent(JSON.stringify(data)))));location.assign(destination.href);
  }
  function keys(e){
   if(!overlay)return;var k=e.keyCode||e.which;
   if(k===10009||k===27||k===8){e.preventDefault();e.stopImmediatePropagation();close();return;}
   if(k===10252||k===415||k===19){e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;if(k===19)video.pause();else if(k===415)play();else overlay.querySelector('#freestyle-compat-toggle').click();return;}
   if(k!==13&&(k<37||k>40))return;e.preventDefault();e.stopImmediatePropagation();
   var nodes=Array.prototype.slice.call(overlay.querySelectorAll('button')).concat(Array.prototype.slice.call(bar.querySelectorAll('button'))),index=nodes.indexOf(document.activeElement);
   if(k===13){if(!e.repeat&&Date.now()-lastClick>180){lastClick=Date.now();if(index<0)nodes[0].focus();else nodes[index].click();}return;}
   if(index<0)index=0;else index=Math.max(0,Math.min(nodes.length-1,index+(k===37||k===38?-1:1)));nodes[index].focus();
  }
  window.addEventListener('keydown',keys,true);message('호환 재생으로 열어주세요.');
  if(typeof userscript!=='undefined')userscript.cleanup=function(){close();window.removeEventListener('keydown',keys,true);bar.remove();delete window.__freestyleSitePlayer;};
 }
 window.freestyleSitePlayer=sitePlayerTools;
})();
