const $=id=>document.getElementById(id);
const KEY='vita_cmms_tasks_v1';
let tasks=load(),deferredPrompt=null,recognition=null,notified=new Set();

function load(){
 try{return JSON.parse(localStorage.getItem(KEY)||'[]')}
 catch{return []}
}
function persist(){
 localStorage.setItem(KEY,JSON.stringify(tasks));
 render();
}
function faNum(n){
 return String(n).replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
}
function safe(s=''){
 return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function jalali(v){
 if(!v)return 'بدون موعد';
 const d=new Date(v);
 if(isNaN(d))return '';
 return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{dateStyle:'medium',timeStyle:'short'}).format(d);
}
function overdue(t){
 return !t.done&&t.dueAt&&new Date(t.dueAt).getTime()<Date.now();
}

function render(){
 const open=tasks.filter(t=>!t.done);
 const today=new Date().toDateString();

 $('openCount').textContent=faNum(open.length);
 $('urgentCount').textContent=faNum(open.filter(t=>t.priority==='urgent').length);
 $('todayCount').textContent=faNum(open.filter(t=>t.dueAt&&new Date(t.dueAt).toDateString()===today).length);
 $('overdueCount').textContent=faNum(open.filter(overdue).length);

 $('todayDate').textContent=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{dateStyle:'full'}).format(new Date());

 const dueToday=open.filter(t=>t.dueAt&&new Date(t.dueAt).toDateString()===today);
 const late=open.filter(overdue);

 $('dailyBrief').textContent=`امروز ${faNum(dueToday.length)} کار سررسید دارد و ${faNum(late.length)} کار عقب‌افتاده است. تعداد کارهای فوری: ${faNum(open.filter(t=>t.priority==='urgent').length)}.`;

 const q=$('search').value.trim().toLowerCase();
 const st=$('statusFilter').value;
 const cat=$('categoryFilter').value;

 const list=tasks.filter(t=>
  (!q||(t.title+' '+t.assignee+' '+t.category).toLowerCase().includes(q))&&
  (st==='all'||(st==='done'?t.done:st==='overdue'?overdue(t):!t.done))&&
  (cat==='all'||t.category===cat)
 ).sort((a,b)=>(a.done-b.done)||((a.dueAt||'').localeCompare(b.dueAt||'')));

 $('taskList').innerHTML='';

 if(!list.length){
  $('taskList').innerHTML='<div class="empty">موردی برای نمایش وجود ندارد.</div>';
 }

 list.forEach(t=>{
  const el=document.createElement('article');
  el.className='task'+(t.done?' done':'')+(overdue(t)?' overdue':'');

  const p=t.priority==='urgent'?'فوری':t.priority==='high'?'مهم':'عادی';

  el.innerHTML=`
   <div class="task-head"><strong></strong><span class="priority p-${safe(t.priority)}">${p}</span></div>
   <div class="meta">
    <span>${safe(t.category)}</span>
    <span>مسئول: ${safe(t.assignee||'تعیین نشده')}</span>
    <span>موعد شمسی: ${jalali(t.dueAt)}</span>
    ${overdue(t)?'<b style="color:#b6402c">عقب‌افتاده</b>':''}
   </div>
   <div class="task-actions">
    <button class="complete">${t.done?'بازگشایی':'✓ انجام شد'}</button>
    <button class="edit">ویرایش</button>
    <button class="delete">حذف</button>
   </div>`;

  el.querySelector('strong').textContent=t.title;

  el.querySelector('.complete').onclick=()=>{
   t.done=!t.done;
   t.reminded=false;
   persist();
  };

  el.querySelector('.edit').onclick=()=>edit(t.id);

  el.querySelector('.delete').onclick=()=>{
   if(confirm('این کار حذف شود؟')){
    tasks=tasks.filter(x=>x.id!==t.id);
    persist();
   }
  };

  $('taskList').appendChild(el);
 });
}

function addTask(){
 const title=$('taskTitle').value.trim();
 if(!title){
  alert('لطفاً شرح کار را وارد کنید.');
  return;
 }

 tasks.unshift({
  id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),
  title,
  category:$('category').value,
  priority:$('priority').value,
  assignee:$('assignee').value.trim(),
  dueAt:$('dueAt').value||'',
  remindBefore:Number($('remindBefore').value),
  done:false,
  createdAt:new Date().toISOString(),
  reminded:false
 });

 $('taskTitle').value='';
 $('assignee').value='';
 $('dueAt').value='';
 persist();
}

function edit(id){
 const t=tasks.find(x=>x.id===id);
 if(!t)return;

 $('editId').value=id;
 $('editTitle').value=t.title;
 $('editAssignee').value=t.assignee||'';
 $('editDue').value=t.dueAt||'';
 $('editPriority').value=t.priority;
 $('editCategory').value=t.category;
 $('editRemindBefore').value=String(t.remindBefore??60);
 $('editDialog').showModal();
}

$('updateBtn').onclick=e=>{
 e.preventDefault();
 const t=tasks.find(x=>x.id===$('editId').value);

 if(t){
  Object.assign(t,{
   title:$('editTitle').value.trim()||t.title,
   assignee:$('editAssignee').value.trim(),
   dueAt:$('editDue').value,
   priority:$('editPriority').value,
   category:$('editCategory').value,
   remindBefore:Number($('editRemindBefore').value),
   reminded:false
  });
  persist();
 }
 $('editDialog').close();
};

$('saveBtn').onclick=addTask;

['search','statusFilter','categoryFilter'].forEach(id=>{
 $(id).addEventListener('input',render);
});

$('voiceBtn').onclick=()=>{
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;

 if(!SR){
  $('voiceStatus').textContent='تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود.';
  return;
 }

 if(recognition){
  recognition.stop();
  return;
 }

 recognition=new SR();
 recognition.lang='fa-IR';
 recognition.interimResults=true;
 recognition.continuous=false;

 $('voiceStatus').textContent='در حال شنیدن...';

 recognition.onresult=e=>{
  let text='';
  for(let i=e.resultIndex;i<e.results.length;i++){
   text+=e.results[i][0].transcript;
  }
  $('taskTitle').value=text;
 };

 recognition.onerror=e=>{
  $('voiceStatus').textContent='خطای میکروفون یا سرویس گفتار: '+e.error;
 };

 recognition.onend=()=>{
  recognition=null;
  $('voiceStatus').textContent='گفتار دریافت شد؛ متن را بررسی و ثبت کنید.';
 };

 try{recognition.start()}
 catch{$('voiceStatus').textContent='شروع میکروفون ممکن نشد.'}
};

$('notifyBtn').onclick=async()=>{
 if(!('Notification'in window)){
  alert('اعلان در این مرورگر پشتیبانی نمی‌شود.');
  return;
 }

 const p=await Notification.requestPermission();

 alert(p==='granted'
  ?'اجازه اعلان فعال شد. برای دریافت یادآوری، برنامه باید فعال یا در پس‌زمینه قابل اجرا باشد.'
  :'اجازه اعلان داده نشد.');
};

function checkDue(){
 if(!('Notification'in window)||Notification.permission!=='granted')return;

 const now=Date.now();

 tasks.forEach(t=>{
  const due=t.dueAt?new Date(t.dueAt).getTime():NaN;
  const remindAt=due-(Number(t.remindBefore||0)*60000);

  if(!t.done&&Number.isFinite(due)&&now>=remindAt&&!t.reminded){
   const key=t.id+':'+t.dueAt;

   if(!notified.has(key)){
    try{
     new Notification('یادآوری VITA CMMS',{body:t.title,tag:t.id});
     notified.add(key);
    }catch(e){}
   }

   t.reminded=true;
   localStorage.setItem(KEY,JSON.stringify(tasks));
  }
 });
}

setInterval(checkDue,15000);

document.addEventListener('visibilitychange',()=>{
 if(!document.hidden)checkDue();
});

$('speakBriefBtn').onclick=()=>{
 const text=$('dailyBrief').textContent;

 if(!('speechSynthesis'in window)){
  alert('خواندن صوتی در این مرورگر پشتیبانی نمی‌شود.');
  return;
 }

 const u=new SpeechSynthesisUtterance(text);
 u.lang='fa-IR';
 speechSynthesis.cancel();
 speechSynthesis.speak(u);
};

$('exportBtn').onclick=()=>{
 const blob=new Blob([
  JSON.stringify({
   app:'VITA CMMS',
   version:2,
   exportedAt:new Date().toISOString(),
   tasks
  },null,2)
 ],{type:'application/json'});

 const a=document.createElement('a');
 a.href=URL.createObjectURL(blob);
 a.download='VITA_CMMS_backup.json';
 a.click();
 URL.revokeObjectURL(a.href);
};

$('importBtn').onclick=()=>$('importFile').click();

$('importFile').onchange=async e=>{
 const f=e.target.files[0];
 if(!f)return;

 try{
  const data=JSON.parse(await f.text());
  const incoming=Array.isArray(data)?data:data.tasks;

  if(!Array.isArray(incoming))throw Error();

  if(confirm('اطلاعات پشتیبان جایگزین فهرست فعلی شود؟')){
   tasks=incoming;
   persist();
   alert('بازیابی انجام شد.');
  }
 }catch{
  alert('فایل پشتیبان معتبر نیست.');
 }

 e.target.value='';
};

if('serviceWorker'in navigator&&location.protocol!=='file:'){
 navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

window.addEventListener('beforeinstallprompt',e=>{
 e.preventDefault();
 deferredPrompt=e;
 $('installBtn').classList.remove('hidden');
});

$('installBtn').onclick=async()=>{
 if(!deferredPrompt)return;
 deferredPrompt.prompt();
 await deferredPrompt.userChoice;
 deferredPrompt=null;
 $('installBtn').classList.add('hidden');
};
$('speakBriefBtn').onclick=()=>{
  const text=$('dailyBrief').textContent.trim();
  if(!('speechSynthesis' in window)){
    alert('مرورگر از خواندن صوتی پشتیبانی نمی‌کند');
    return;
  }
  speechSynthesis.cancel();
  const msg=new SpeechSynthesisUtterance(text);
  msg.lang='fa-IR';
  msg.rate=0.9;
  speechSynthesis.speak(msg);
};
render();
checkDue();
