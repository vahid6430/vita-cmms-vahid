async function checkDue(){
 if(!('Notification' in window)) return;
 if(Notification.permission !== 'granted') return;
 if(!('serviceWorker' in navigator)) return;

 try {
  const registration = await navigator.serviceWorker.ready;
  const now = Date.now();

  for(const t of tasks){
   const due = t.dueAt ? new Date(t.dueAt).getTime() : NaN;
   const remindAt = due - (Number(t.remindBefore || 0) * 60000);
   const key = t.id + ':' + t.dueAt;

   if(!t.done && Number.isFinite(due) && now >= remindAt && !t.reminded){
    await registration.showNotification('یادآوری VITA CMMS', {
     body: t.title,
     icon: './icon.svg',
     tag: key,
     data: {url: './'}
    });

    t.reminded = true;
    localStorage.setItem(KEY, JSON.stringify(tasks));
   }
  }
 } catch(error) {
  console.error('Notification error:', error);
 }
}
