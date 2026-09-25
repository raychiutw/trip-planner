const variants=[['A','底部同意 sheet','sheet'],['B','完整審閱畫面','review'],['C','輸入框內嵌卡','inline']];
function current(){const v=new URLSearchParams(location.search).get('variant');return Math.max(0,variants.findIndex(x=>x[0]===v));}
function show(index){const v=variants[(index+variants.length)%variants.length];const url=new URL(location.href);url.searchParams.set('variant',v[0]);history.replaceState(null,'',url);for(const [, ,id] of variants)document.getElementById(id).classList.toggle('active',id===v[2]);document.getElementById('label').textContent=`${v[0]} — ${v[1]}`;}
document.getElementById('prev').onclick=()=>show(current()-1);document.getElementById('next').onclick=()=>show(current()+1);
window.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key)||e.target.closest('input,textarea,[contenteditable]'))return;show(current()+(e.key==='ArrowRight'?1:-1));});
show(current());
