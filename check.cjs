// Run with Node.js; isolated storage, never accesses the user's browser data.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map();function el(){return {innerHTML:'',textContent:'',hidden:true,value:'',style:{setProperty(){}},dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false}},setAttribute(){},addEventListener(){},querySelectorAll(){return []},focus(){},get scrollHeight(){return 100},get clientHeight(){return 100}}}
const storage=new Map();const context=vm.createContext({console,URL,URLSearchParams,Date,Set,Intl,crypto:require('node:crypto').webcrypto,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id)},querySelectorAll:()=>[],querySelector:()=>el(),body:{classList:el().classList},documentElement:el(),addEventListener(){}},window:{addEventListener(){},scrollTo(){}},matchMedia:()=>({matches:false}),location:{hash:''},setTimeout:()=>0,clearTimeout(){}});
vm.runInContext(fs.readFileSync('public-data.js','utf8'),context);vm.runInContext(fs.readFileSync('sample.js','utf8'),context);vm.runInContext(fs.readFileSync('app.js','utf8'),context);
function run(s){return vm.runInContext(s,context)}
const old={id:'old',date:'2026-11-01',title:'旧周报',entries:[{id:'old-1',title:'旧标题',detail:'原始完整正文',topic:'文献与史料',tags:['完整周报','手动导入']}]};context.old=old;
assert.equal(run('normalize(old).body'),'原始完整正文');assert.equal(run('normalize(old).entries[0].id'),'old-1');assert.equal(run('normalize(old).entries.length'),1);assert.equal(run('normalize(old).entries[0].tags.includes("文献与史料")'),true);
assert.equal(run('reports()[0].entries[0].id'),'s1');assert.equal(storage.size,0,'Loading must not rewrite browser storage');
assert.equal(run('week("2027-01-01").year'),2026);assert.equal(run('week("2027-01-01").num'),53);assert.equal(run('isDate("2026-02-30")'),false);
const unsafe=run('bodyHTML("## 标题\\n<img src=x onerror=alert(1)>\\n[危险](javascript:alert(1))\\n[安全](https://example.com/?q=1&b=2)")');assert(!unsafe.includes('<img'));assert(!unsafe.includes('href="javascript:'));assert(unsafe.includes('target="_blank" rel="noopener noreferrer"'));assert(unsafe.includes('id="heading-1"'));
context.backup={format:'research-weekly-v1',reports:[old],bookmarks:['old-1']};assert.equal(run('validateBackup(backup).bookmarks[0]'),'old-1');assert.throws(()=>run('validateBackup({...backup,reports:[old,old]})'));
run('userReports=[old]; saved=["old-1"]; view="saved"; render()');assert(elements.get('content').innerHTML.includes('旧标题'));run('view="search";query="原始完整正文";render()');assert(elements.get('results').innerHTML.includes('旧标题'));run('view="archive";render()');assert.equal((elements.get('content').innerHTML.match(/data-week=/g)||[]).length,2);
console.log('PASS: syntax/startup, non-destructive loading, v1 migration, stable IDs/bookmarks, search, weekly archives, ISO weeks, date validation, safe text/links, backup validation.');

(async()=>{
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
 context.fixture=read('data/weekly/2026-W46.json');context.index=read('data/index.json');
 assert.equal(run('validateIndex(index).length'),1);assert.equal(run('validatePublic(fixture).origin'),'public');
 assert.throws(()=>run('validatePublic({...fixture,week:"2026-W01"})'));
 assert.throws(()=>run('validateIndex({version:1,reports:[...index.reports,...index.reports]})'));
 assert.throws(()=>run('validatePublic({...fixture,entries:[{...fixture.entries[0],references:[{title:"bad",url:"javascript:alert(1)"}]}]})'));
 context.fetch=async p=>({ok:true,json:async()=>p==='data/index.json'?context.index:context.fixture});
 await run('loadPublic()');assert.equal(run('publicReports.length'),1);assert.equal(storage.size,0);
 run('currentId=null;view="home";render()');assert(elements.get('content').innerHTML.includes('浏览器本地报告'));
 run('currentId=fixture.id;selected=new Set(["资料整理"]);render()');assert(elements.get('content').innerHTML.includes('data-open='));
 run('selected=new Set(["无匹配"]);render()');assert(!elements.get('content').innerHTML.includes('data-open='));
 run('selected.clear();openReader(fixture.id,fixture.entries[0].id)');assert(elements.get('article').innerHTML.includes('学术评价'));assert(elements.get('article').innerHTML.includes('target="_blank"'));
 run('$("save").onclick()');assert(run('saved.includes(fixture.entries[0].id)'));run('view="saved";render()');assert(elements.get('content').innerHTML.includes('验证多标签'));
 run('$("save").onclick()');assert(!run('saved.includes(fixture.entries[0].id)'));
 run('publicReports.push({...validatePublic(fixture),id:"rw-public:formal",demo:false,date:"2026-10-01"});currentId=null');assert.equal(run('active().id'),'rw-public:formal');
 assert(run('reports().every((r,i,all)=>!i||all[i-1].date>=r.date)'));
 run('view="archive";render()');assert(elements.get('content').innerHTML.includes('公开发布的周报'));assert(elements.get('content').innerHTML.includes('公开演示数据'));
 run('userReports.push({...fixture,title:"本地优先"})');assert.equal(run('reports().filter(r=>r.id===fixture.id).length'),1);assert.equal(run('reports().find(r=>r.id===fixture.id).title'),'本地优先');
 const before=storage.get('rw-reports-v1');context.fetch=async()=>{throw Error('offline')};await run('loadPublic()');assert(elements.get('publicStatus').textContent.includes('读取失败'));assert.equal(storage.get('rw-reports-v1'),before);assert(run('reports().some(r=>r.id==="old")'));
 context.fetch=async p=>p==='data/index.json'?{ok:true,json:async()=>context.index}:{ok:false,status:404};await run('loadPublic()');assert(elements.get('publicStatus').textContent.includes('部分'));assert.equal(run('publicReports.length'),0);
 assert(!run('researchHTML({references:[{title:"<script>",url:"javascript:alert(1)",publishedAt:"",sourceType:""}]})').includes('href='));
 console.log('PASS: public JSON loading/validation, date order, filters, reader, local precedence, bookmarks, archives, request failures, safe references.');
})().catch(e=>{console.error(e);process.exitCode=1});
