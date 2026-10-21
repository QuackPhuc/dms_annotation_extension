"""Large-list playback and cached Space playback with local DMS responses."""
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

from test_sidebar_scroll import HTML as SIDEBAR_HTML
from test_preload import HTML as CACHE_HTML

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = (ROOT/'extension/content.js').read_text(encoding='utf-8')
PRELOAD = (ROOT/'extension/preload.js').read_text(encoding='utf-8')
PNG = (ROOT/'extension/icons/icon16.png').read_bytes()

# Standalone contracts; local runs additionally exercise the saved viewer's
# actual cache, playback loop and row-marking functions when available.
CACHE = CACHE_HTML[CACHE_HTML.index('function fkey(g)'):CACHE_HTML.index('</script>')]
PLAYBACK = """
function play(){if(S.playing)return;S.playing=true;S.tok++;resyncAt(S.g);loop(S.tok);}
function pause(){S.playing=false;S.tok++;}
async function loop(tok){
  const alive=()=>S.playing && tok===S.tok;
  while(alive()){
    const next=playNext(S.g,1);if(next===S.g){pause();break;}
    for(let k=0,g=next;k<AHEAD;k++){
      const ng=playNext(g,1);if(ng===g || S.inflight.size>=MAX_INFLIGHT)break;
      g=ng;if(!S.frames.has(fkey(g)))getFrame(g).catch(()=>{});
    }
    const bitmap=await getFrame(next);if(!alive())return;
    const wait=S.wall0+S.ts[next]-S.t0-performance.now();if(wait>1)await sleep(wait);
    if(!alive())return;S.g=S.shownG=next;S.bmp=bitmap;paint();drawBar();
  }
}
"""
MARK = """
function rvMarkLab(){
  if(S.mode==='label' && S.onlyTodo && S.lseq.some(g=>fsGet(g)==='done')){
    buildSeq();renderLabList();drawBar();return;
  }
  for(const li of document.querySelector('#labList').querySelectorAll('li')){
    const on=Number(li.dataset.g)===S.shownG;li.classList.toggle('cur',on);
    if(on)li.scrollIntoView({block:'nearest'});
  }
  lsBoxRender();r2Render();
}
"""
native_dir = ROOT.parent/'NOTA_LABEL/DMS Web Viewer_files'
if (native_dir/'app.js.download').exists():
    source=(native_dir/'app.js.download').read_text(encoding='utf-8')
    CACHE=source[source.index('function fkey(g)'):source.index('\nlet _hashT')]
    PLAYBACK=source[source.index('function play()'):source.index('\nfunction playNext(g, step)')]
if (native_dir/'review.js.download').exists():
    source=(native_dir/'review.js.download').read_text(encoding='utf-8')
    a=source.index('function rvMarkLab()')
    MARK=source[a:source.index('\nfunction renderFinal()',a)]

SETUP = """
const MAX_BITMAPS=240,MAX_INFLIGHT=6,AHEAD=8,SPEEDS=[.25,.5,1,2,3,5,10];
const enc=encodeURIComponent,$=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
Object.assign(S,{speedI:2,playing:false,tok:0,step10:true,clip:null,ts:Float64Array.from({length:S.G},(_,i)=>i*100)});
window.painted=[];window.pauseAt=-1;window.decodes=0;window.statusPaints=0;
function lsBoxRender(){window.statusPaints++;}
function r2Render(){}
function seqMode(){return false;}
function updPlayBtn(){}
function saveHash(){}
function saveHashSoon(){}
function resyncAt(g){S.wall0=performance.now();S.t0=S.ts[g];}
function msg(text){window.lastMessage=text;}
function nextG(g,dir,n=1){return Math.max(0,Math.min(S.G-1,g+dir*n));}
function playNext(g,step=1){return nextG(g,1,step);}
function paint(){
  if(S.bmp)document.querySelector('#view').getContext('2d').drawImage(S.bmp,0,0);
  rvMarkLab();window.painted.push({g:S.shownG,t:performance.now()});
  if(S.shownG===window.pauseAt)pause();
}
document.addEventListener('keydown',e=>{
  if(e.code==='Space' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){
    e.preventDefault();S.playing ? pause() : play();
  }
});
"""


def fixture(count):
    group=count//4
    html=SIDEBAR_HTML.replace('G:600',f'G:{count}').replace('n:600',f'n:{count}')
    html=html.replace('g/150',f'g/{group}').replace('g%150',f'g%{group}')
    return html.replace('</body>', '<div id="spin" hidden></div><script>'+'\n'.join([SETUP,CACHE,PLAYBACK,MARK])+'\n</script></body>')


def settle(page):
    page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')


def open_page(browser,count):
    page=browser.new_page(viewport={'width':1200,'height':820})
    errors,requests=[],[]
    page.on('pageerror',lambda error:errors.append(str(error)))

    def route(r):
        path=urlparse(r.request.url).path
        if path=='/':r.fulfill(body=fixture(count),content_type='text/html')
        elif path=='/api/frame':
            requests.append(r.request.url)
            r.fulfill(body=PNG,content_type='image/png')
        else:raise AssertionError(f'Unexpected network request: {r.request.method} {path}')

    page.route('**/*',route);page.goto('https://ntt.dev.nota.ai/')
    assert not errors,errors
    page.add_script_tag(content=SCRIPT);page.wait_for_selector('.nl-organized');settle(page)
    return page,errors,requests


def test_large_list(browser):
    page,errors,requests=open_page(browser,12000)
    # A native cache hit can be immediate while DOM work still blocks playback.
    # Count enumerated sidebar nodes as well as reporting wall time; assertions
    # use operation counts so slow CI machines do not fail timing thresholds.
    result=page.evaluate('''async()=>{
      playNext(200,1);
      const original=Element.prototype.querySelectorAll;
      let enumerated=0;
      Element.prototype.querySelectorAll=function(...args){
        const result=original.apply(this,args);
        if(this.id==='labList' || this.closest('#labList'))enumerated+=result.length;
        return result;
      };
      const times=[];
      try{
        for(let i=0;i<30;i++){
          S.g=S.shownG=200+i;
          const start=performance.now();
          for(let k=0,g=S.g;k<9;k++)g=playNext(g,1);
          times.push(performance.now()-start);
          rvMarkLab();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        }
      }finally{Element.prototype.querySelectorAll=original;}
      return {enumerated,times,current:document.querySelector('#labList li.cur')?.dataset.g,statusPaints:window.statusPaints};
    }''')
    assert result['enumerated']<100,result
    assert result['current']=='229' and result['statusPaints']>=30
    assert not requests,requests
    values=sorted(result['times'])
    print(f"PASS: 12,000 frames, 30 playback iterations: {result['enumerated']} sidebar nodes enumerated; median lookahead {values[len(values)//2]:.2f} ms")

    page.locator('.nl-search').fill('Phone call');settle(page)
    assert page.evaluate('playNext(3000,10)')==3010
    assert page.evaluate('playNext(5999,1)')==5999
    # Hidden current frames retain the original all-list fallback.
    assert page.evaluate('playNext(2999,1)')==3000
    page.locator('.nl-search').fill('');settle(page)
    assert page.evaluate('playNext(5999,1)')==6000
    page.evaluate("S.lseq=Int32Array.from([10,20,30]);S.g=S.shownG=20;renderLabList()")
    settle(page)
    assert page.evaluate('playNext(20,1)')==30
    assert page.evaluate('playNext(30,1)')==30
    page.evaluate("S.labelSel='hand';S.gen++;S.lseq=Int32Array.from([40,50]);S.g=S.shownG=40;renderLabList()")
    settle(page)
    assert page.evaluate('playNext(40,1)')==50
    print('PASS: filtered playback and clip/list boundaries; list rebuild and label/session invalidation')

    # Retain native only-todo semantics and current status updates.
    page.evaluate("S.onlyTodo=true;S.fstat['segment:50']={hand:{s:'done'}};rvMarkLab()")
    settle(page)
    assert page.locator('#labList li[data-g="50"]').count()==0
    page.evaluate("S.fstat['segment:50']={hand:{s:'wip'}};fsRender()")
    settle(page)
    assert page.locator('#labList li[data-g="50"]').count()==1
    assert not errors,errors
    page.close()
    print('PASS: Done removes rows under only-todo; status rollback/rebuild restores them')


def test_cached_space(browser):
    page,errors,requests=open_page(browser,32)
    page.add_script_tag(content=PRELOAD)
    page.locator('#start_auto_load').click()
    page.wait_for_function("document.querySelector('.nl-load-count').textContent==='Ready 16 / 16 images'")
    assert page.evaluate('S.frames.size')==0
    page.evaluate('show(0)')
    page.evaluate('window.painted=[];window.pauseAt=6')
    page.locator('#start_auto_load').evaluate('el=>el.blur()')
    before=len(requests)
    page.keyboard.press('Space')
    page.wait_for_function('S.shownG===6 && !S.playing && S.inflight.size===0')
    assert len(requests)==before,(before,len(requests))
    assert page.evaluate('window.painted.map(p=>p.g)')==[1,2,3,4,5,6]
    assert page.locator('#labList li.cur').get_attribute('data-g')=='6'
    assert page.evaluate('S.frames.size')<=16
    assert not errors,errors
    page.close()
    print('PASS: native Space playback renders each cached frame in order, no additional image requests; bounded lookahead and pause')


def main():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True)
        try:
            test_large_list(browser)
            test_cached_space(browser)
        finally:browser.close()


if __name__=='__main__':main()
