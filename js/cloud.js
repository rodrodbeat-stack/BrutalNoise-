/* NEURAL AUDIO 2050 — Supabase Auth + community + media */
(()=> {
 const $=s=>document.querySelector(s);
 const ready=()=>window.supabase&&window.NEURAL_SUPABASE_URL&&window.NEURAL_SUPABASE_PUBLISHABLE_KEY;
 if(!ready()){console.error('Supabase SDK/config missing');return}
 const db=window.supabase.createClient(window.NEURAL_SUPABASE_URL,window.NEURAL_SUPABASE_PUBLISHABLE_KEY);
 window.neuralDB=db;
 let currentUser=null, selectedMedia=[];
 const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function ensureModal(){
  if($('#authModal'))return;
  const m=document.createElement('div');m.id='authModal';m.innerHTML='<section class="auth-card panel"><button class="auth-close" id="authClose">×</button><small>888 DIGITAL FACTORY // SECURE ACCESS</small><h2>NEURAL <em>IDENTITY</em></h2><p id="authHint">Accede a tu comunidad musical.</p><form id="authForm"><label id="nameWrap" hidden>Nombre visible<input id="authName" autocomplete="name" maxlength="40"></label><label>Email<input id="authEmail" type="email" autocomplete="email" required></label><label>Contraseña<input id="authPassword" type="password" minlength="6" autocomplete="current-password" required></label><button class="red-button" id="authSubmit">INICIAR SESIÓN</button></form><button id="authSwitch" class="auth-switch">¿No tienes cuenta? Crear cuenta</button><p id="authStatus" role="status"></p></section>';document.body.append(m);
  $('#authClose').onclick=()=>m.classList.remove('show');m.onclick=e=>{if(e.target===m)m.classList.remove('show')};
  let signup=false;$('#authSwitch').onclick=()=>{signup=!signup;$('#nameWrap').hidden=!signup;$('#authSubmit').textContent=signup?'CREAR CUENTA':'INICIAR SESIÓN';$('#authSwitch').textContent=signup?'Ya tengo cuenta':'¿No tienes cuenta? Crear cuenta';$('#authHint').textContent=signup?'Crea tu identidad Neural Audio.':'Accede a tu comunidad musical.';$('#authPassword').autocomplete=signup?'new-password':'current-password'};
  $('#authForm').onsubmit=async e=>{e.preventDefault();const status=$('#authStatus');status.textContent='Conectando con el núcleo seguro...';const email=$('#authEmail').value.trim(),password=$('#authPassword').value;let result;
   if(signup)result=await db.auth.signUp({email,password,options:{data:{display_name:$('#authName').value.trim()||email.split('@')[0]}}});
   else result=await db.auth.signInWithPassword({email,password});
   if(result.error){status.textContent=result.error.message;return}
   status.textContent=signup?'Cuenta creada. Revisa tu correo si la confirmación está activada.':'Acceso autorizado.';if(result.data.session)setTimeout(()=>m.classList.remove('show'),700);
  };
 }
 function authOpen(){ensureModal();$('#authModal').classList.add('show');$('#authStatus').textContent=''}
 function setIdentity(user){
  currentUser=user;
  const chip=$('#profile');if(chip){chip.innerHTML=user?'◉ <span>'+esc(user.user_metadata?.display_name||user.email?.split('@')[0]||'Mi perfil')+'</span>⌄':'◉ <span>Iniciar sesión</span>⌄'}
  $('#publish').disabled=!user;$('#post').placeholder=user?'¿Qué estás escuchando o compartiendo?':'Inicia sesión para publicar en la comunidad';
  $('#uploadStatus').textContent=user?'CUENTA CONECTADA · NEURAL NETWORK':'INICIA SESIÓN PARA PUBLICAR';
 }
 async function loadFeed(){
  const {data,error}=await db.from('posts').select('id,user_id,content,media_path,media_type,created_at,profiles(username,display_name,avatar_url)').order('created_at',{ascending:false}).limit(30);
  if(error){console.warn('Feed Supabase:',error.message);return}
  document.querySelectorAll('.cloud-post').forEach(n=>n.remove());
  for(const p of data||[]){const card=document.createElement('article');card.className='post panel cloud-post';const name=p.profiles?.display_name||p.profiles?.username||'Neural member';const when=new Date(p.created_at).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'});let media='';
   if(p.media_path){const {data:pub}=db.storage.from('neural-media').getPublicUrl(p.media_path);const url=pub.publicUrl;media=p.media_type?.startsWith('image/')?'<img class="cloud-media" src="'+esc(url)+'" alt="Contenido compartido">':p.media_type?.startsWith('video/')?'<video class="cloud-media" src="'+esc(url)+'" controls playsinline></video>':p.media_type?.startsWith('audio/')?'<audio class="cloud-media" src="'+esc(url)+'" controls></audio>':''}
   card.innerHTML='<header><b class="avatar">NA</b><div><strong>'+esc(name)+'</strong><small>'+when+' · Comunidad</small></div></header>'+(p.content?'<p>'+esc(p.content)+'</p>':'')+media+'<div class="post-actions"><span>NEURAL AUDIO 2050</span></div>';
   $('#community').before(card);
  }
 }
 async function publishCloud(){
  if(!currentUser){authOpen();return}
  const content=$('#post').value.trim(),file=selectedMedia[0];if(!content&&!file){$('#authStatus')?.textContent;$('#uploadStatus').textContent='ESCRIBE ALGO O ADJUNTA UN ARCHIVO';return}
  $('#publish').disabled=true;$('#uploadStatus').textContent='SUBIENDO A NEURAL CLOUD...';
  try{
   let media_path=null,media_type=null;
   if(file){const ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');media_path=currentUser.id+'/'+crypto.randomUUID()+'.'+ext;media_type=file.type||'application/octet-stream';const {error:upErr}=await db.storage.from('neural-media').upload(media_path,file,{contentType:media_type,upsert:false});if(upErr)throw upErr}
   const {error}=await db.from('posts').insert({user_id:currentUser.id,content,media_path,media_type});if(error)throw error;
   $('#post').value='';selectedMedia=[];['images','videos','files'].forEach(id=>{const el=$('#'+id);if(el)el.value=''});$('#uploadStatus').textContent='PUBLICADO EN NEURAL NETWORK ✓';await loadFeed();
  }catch(err){console.error(err);$('#uploadStatus').textContent='ERROR: '+(err.message||'No se pudo publicar');}
  finally{$('#publish').disabled=!currentUser}
 }
 async function boot(){
  ensureModal();
  $('#profile').onclick=()=>currentUser?db.auth.signOut().then(()=>{$('#authStatus').textContent='Sesión cerrada'}):authOpen();
  $('#publish').onclick=publishCloud;
  ['images','videos','files'].forEach(id=>$('#'+id).addEventListener('change',e=>{selectedMedia=[...e.target.files].slice(0,1);$('#uploadStatus').textContent=selectedMedia.length?'ADJUNTO: '+selectedMedia[0].name:'SIN ARCHIVO'}));
  const {data:{session}}=await db.auth.getSession();setIdentity(session?.user||null);await loadFeed();
  db.auth.onAuthStateChange((_event,session)=>{setIdentity(session?.user||null);if(session?.user)loadFeed()});
  try{db.channel('neural-live-posts').on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>loadFeed()).subscribe()}catch(e){console.warn(e)}
 }
 boot();
})();