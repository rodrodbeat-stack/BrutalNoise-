/* NEURAL AUDIO 2050 — acceso invitado persistente + publicaciones Supabase */
(()=> {
 const $=s=>document.querySelector(s);
 const ready=()=>window.supabase&&window.NEURAL_SUPABASE_URL&&window.NEURAL_SUPABASE_PUBLISHABLE_KEY;
 if(!ready()){console.error('Supabase SDK/config missing');return}
 const db=window.supabase.createClient(window.NEURAL_SUPABASE_URL,window.NEURAL_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 window.neuralDB=db;
 let currentUser=null, selectedMedia=[];
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function status(message){const el=$('#uploadStatus');if(el)el.textContent=message}
 function identityName(user){return user?.user_metadata?.display_name||user?.user_metadata?.username||'Operador invitado'}
 function setIdentity(user){
  currentUser=user;
  const chip=$('#profile');
  if(chip)chip.innerHTML=user?'◉ <span>'+esc(identityName(user))+'</span>⌄':'◉ <span>Conectando...</span>⌄';
  const publish=$('#publish'),post=$('#post');
  if(publish)publish.disabled=!user;
  if(post)post.placeholder=user?'¿Qué estás escuchando o compartiendo?':'Conectando con Neural Network...';
  if(user)status('MODO INVITADO ACTIVO · IDENTIDAD GUARDADA EN ESTE DISPOSITIVO');
 }
 async function ensureGuest(){
  const {data:{session},error:sessionError}=await db.auth.getSession();
  if(sessionError)throw sessionError;
  if(session?.user)return session.user;
  const {data,error}=await db.auth.signInAnonymously({options:{data:{display_name:'Operador invitado'}}});
  if(error)throw error;
  if(!data.user)throw new Error('Supabase no devolvió una identidad de invitado.');
  return data.user;
 }
 async function loadFeed(){
  const {data,error}=await db.from('posts').select('id,user_id,content,media_path,media_type,created_at,profiles(username,display_name)').order('created_at',{ascending:false}).limit(40);
  if(error){console.warn('Feed Supabase:',error.message);status('FEED: '+error.message);return}
  document.querySelectorAll('.cloud-post').forEach(n=>n.remove());
  const anchor=$('#community');
  for(const p of data||[]){
   const card=document.createElement('article');card.className='post panel cloud-post';
   const profile=Array.isArray(p.profiles)?p.profiles[0]:p.profiles;
   const name=profile?.display_name||profile?.username||'Neural member';
   const when=new Date(p.created_at).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'});
   let media='';
   if(p.media_path){
    const {data:pub}=db.storage.from('neural-media').getPublicUrl(p.media_path);const url=pub.publicUrl;
    if(p.media_type?.startsWith('image/'))media='<img class="cloud-media" src="'+esc(url)+'" alt="Contenido compartido" loading="lazy">';
    else if(p.media_type?.startsWith('video/'))media='<video class="cloud-media" src="'+esc(url)+'" controls playsinline preload="metadata"></video>';
    else if(p.media_type?.startsWith('audio/'))media='<audio class="cloud-media" src="'+esc(url)+'" controls preload="metadata"></audio>';
   }
   card.innerHTML='<header><b class="avatar">NA</b><div><strong>'+esc(name)+'</strong><small>'+when+' · Comunidad</small></div></header>'+(p.content?'<p>'+esc(p.content)+'</p>':'')+media+'<div class="post-actions"><span>NEURAL AUDIO 2050</span></div>';
   anchor?.before(card);
  }
 }
 async function publishCloud(){
  if(!currentUser){status('ESPERA: CONECTANDO IDENTIDAD INVITADA');return}
  const content=$('#post').value.trim(),file=selectedMedia[0];
  if(!content&&!file){status('ESCRIBE ALGO O ADJUNTA AUDIO, IMAGEN O VIDEO');return}
  const button=$('#publish');button.disabled=true;status('SUBIENDO A NEURAL CLOUD...');
  let uploadedPath=null;
  try{
   let media_path=null,media_type=null;
   if(file){
    const ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'')||'bin';
    media_path=currentUser.id+'/'+crypto.randomUUID()+'.'+ext;media_type=file.type||'application/octet-stream';
    const {error:upErr}=await db.storage.from('neural-media').upload(media_path,file,{contentType:media_type,upsert:false});
    if(upErr)throw upErr;uploadedPath=media_path;
   }
   const {error}=await db.from('posts').insert({user_id:currentUser.id,content,media_path,media_type});
   if(error)throw error;
   $('#post').value='';selectedMedia=[];
   ['images','videos','files'].forEach(id=>{const el=$('#'+id);if(el)el.value=''});
   status('PUBLICADO Y GUARDADO EN NEURAL CLOUD ✓');await loadFeed();
  }catch(err){
   console.error('Publicación:',err);
   if(uploadedPath)console.warn('El archivo quedó cargado pero no se creó la publicación:',uploadedPath);
   status('ERROR AL PUBLICAR: '+(err.message||'revisa Supabase'));
  }finally{button.disabled=!currentUser}
 }
 async function boot(){
  const chip=$('#profile');if(chip)chip.onclick=async()=>{if(!currentUser)return;const ok=confirm('¿Cerrar esta identidad de invitado en este dispositivo? Tus publicaciones permanecerán en la comunidad.');if(ok){await db.auth.signOut();setIdentity(null);status('SESIÓN CERRADA · RECONECTANDO...');try{setIdentity(await ensureGuest());}catch(e){status('ERROR DE ACCESO: '+e.message)}}};
  const publish=$('#publish');if(publish)publish.onclick=publishCloud;
  /* Captura los archivos antes de que el reproductor local limpie los inputs. */
  ['images','videos','files'].forEach(id=>{const el=$('#'+id);if(el)el.addEventListener('change',e=>{selectedMedia=[...(e.target.files||[])].slice(0,1);if(selectedMedia[0])status('ARCHIVO PREPARADO: '+selectedMedia[0].name);},true)});
  try{
   status('ESTABLECIENDO IDENTIDAD INVITADA...');
   const user=await ensureGuest();setIdentity(user);await loadFeed();
   db.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT')setIdentity(null);else if(session?.user)setIdentity(session.user)});
   db.channel('neural-live-posts').on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>loadFeed()).subscribe();
  }catch(err){
   console.error('Neural Auth:',err);setIdentity(null);
   status('ACTIVA ANONYMOUS SIGN-INS EN SUPABASE AUTH · '+(err.message||'Error de conexión'));
   if(publish)publish.disabled=true;
  }
 }
 boot();
})();