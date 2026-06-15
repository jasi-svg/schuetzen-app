/* ============================================================
   DIGITALER STRAFENKATALOG · App-Logik
   Speicherung: localStorage (ein Gerät). Daten bleiben kompatibel
   zur bisherigen Version (gleiche Schlüssel & Felder).
   ============================================================ */

/* ---------- Supabase ---------- */
const sb = supabase.createClient(
  'https://hohduipsxbbgesbgwnwq.supabase.co',
  'sb_publishable_s2lekHNDQaoVlK_oxXj60A_PvifrHo-'
);
let sbSession  = null;
let sbClubId   = null;
let sbClubName = null;
let sbInviteCode = null;

/* ---------- Realtime ---------- */
let realtimeChannel = null;
let realtimeDebounceTimer = null;
function datenNeuLadenDebounced(){
  clearTimeout(realtimeDebounceTimer);
  realtimeDebounceTimer = setTimeout(async () => { await clubDatenLaden(); }, 400);
}
function realtimeStarten(){
  if(realtimeChannel) return;
  realtimeChannel = sb.channel('club-live');
  ['strafen','anwesenheiten','members','termine','strafarten','clubs','saisons','umfragen','umfrage_optionen','umfrage_stimmen','kassenbuchungen'].forEach(tabelle => {
    realtimeChannel.on('postgres_changes',
      { event: '*', schema: 'public', table: tabelle },
      () => datenNeuLadenDebounced()
    );
  });
  realtimeChannel.subscribe();
}
function realtimeStoppen(){
  if(realtimeChannel){ sb.removeChannel(realtimeChannel); realtimeChannel = null; }
}

/* ---------- Zustand ---------- */
let schuetzen = [];
let strafarten = [];
let strafen = [];
let anwesenheiten = [];
let termine = [];
let saisons = [];
let aktuellerBenutzer = null;
let zugname = 'Digitaler Strafenkatalog';
let logo = '';
let aktuelleSeite = 'dashboard';
let customBadgeTypes = [];
let umfragen = [];
let umfrageOptionen = [];
let umfrageStimmen = [];
let kassenbuchungen = [];
let strafenStatusFilter = 'alle';

/* ---------- Hilfen ---------- */
function neueId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function escapeHtml(t){ return String(t==null?'':t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function euro(n){ return (Math.round(n*100)/100).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €'; }
function istOffizier(s){ return !!s && (s.rolle==='Spieß' || s.rolle==='Oberleutnant' || s.rolle==='Leutnant'); }
function darfBearbeiten(){ return istOffizier(aktuellerBenutzer); }
function findSchuetze(id){ return schuetzen.find(s => s.id === id); }
function kassenstandBerechnen(){
  const ein = kassenbuchungen.filter(b => b.typ === 'einnahme').reduce((a, b) => a + b.betrag, 0);
  const aus = kassenbuchungen.filter(b => b.typ === 'ausgabe').reduce((a, b) => a + b.betrag, 0);
  return ein - aus;
}

/* ---------- Speichern / Laden ---------- */
function speichern(){
  localStorage.setItem('schuetzen', JSON.stringify(schuetzen));
  localStorage.setItem('strafarten', JSON.stringify(strafarten));
  localStorage.setItem('strafen', JSON.stringify(strafen));
  localStorage.setItem('anwesenheiten', JSON.stringify(anwesenheiten));
  localStorage.setItem('termine', JSON.stringify(termine));
  localStorage.setItem('saisons', JSON.stringify(saisons));
  localStorage.setItem('zugname', zugname);
  localStorage.setItem('logo', logo);
}

function datenLaden(){
  try{
    schuetzen     = JSON.parse(localStorage.getItem('schuetzen'))     || [];
    strafarten    = JSON.parse(localStorage.getItem('strafarten'))    || [];
    strafen       = JSON.parse(localStorage.getItem('strafen'))       || [];
    anwesenheiten = JSON.parse(localStorage.getItem('anwesenheiten')) || [];
    termine       = JSON.parse(localStorage.getItem('termine'))       || [];
    saisons       = JSON.parse(localStorage.getItem('saisons'))       || [];
    zugname       = localStorage.getItem('zugname') || 'Digitaler Strafenkatalog';
    logo          = localStorage.getItem('logo') || '';
  }catch(e){ console.error('Laden fehlgeschlagen', e); }

  // Zahlungsfelder bei älteren Strafen nachrüsten
  strafen.forEach(x => {
    if(x.bezahltArt == null) x.bezahltArt = '';
    if(x.bezahltDatum == null) x.bezahltDatum = '';
  });

  // Felder nachrüsten (Abwärtskompatibilität)
  schuetzen.forEach(s => {
    if(s.id == null) s.id = neueId();
    if(s.aktiv == null) s.aktiv = true;
    if(s.bild == null) s.bild = '';
    if(s.email == null) s.email = '';
    if(!s.benutzername) s.benutzername = (s.name||'').toLowerCase().replace(/\s+/g,'.');
    if(!s.passwort) s.passwort = '1234';
    if(!s.rolle) s.rolle = 'Schütze';
  });

  speichern();
}

/* ============================================================
   NAVIGATION
   ============================================================ */
const seitenMap = {
  dashboard:'dashboardSeite', profil:'profilSeite', strafen:'strafenSeite',
  kalender:'kalenderSeite', ranking:'rankingSeite', kasse:'kasseSeite',
  mitglieder:'mitgliederSeite',
  anwesenheit:'anwesenheitSeite', abstimmungen:'abstimmungenSeite',
  akten:'aktenSeite', einstellungen:'einstellungenSeite', hilfe:'hilfeSeite',
  chronik:'chronikSeite'
};

function seiteAnzeigen(seite){
  aktuelleSeite = seite;
  Object.values(seitenMap).forEach(id => document.getElementById(id)?.classList.add('hidden'));
  document.getElementById(seitenMap[seite])?.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('nav-'+seite)?.classList.add('active');
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-'+seite)?.classList.add('active');

  menueSchliessen();
  window.scrollTo({top:0, behavior:'smooth'});
}

function menueOeffnen(){ document.getElementById('menueOverlay').classList.remove('hidden'); }
function menueSchliessen(){ document.getElementById('menueOverlay')?.classList.add('hidden'); }
function schnellStrafe(){ seiteAnzeigen('strafen'); document.getElementById('schuetzeSelect')?.focus(); }
function datenschutzAnzeigen(){ document.getElementById('datenschutzSeite').classList.remove('hidden'); }
function datenschutzSchliessen(){ document.getElementById('datenschutzSeite').classList.add('hidden'); }

function einladungscodeKopieren(){
  if(!sbInviteCode) return;
  navigator.clipboard.writeText(sbInviteCode)
    .then(()=> showToast('Code kopiert ✓'))
    .catch(()=> showToast('Kopieren fehlgeschlagen','error'));
}

function installSeiteAnzeigen(){
  const box = document.getElementById('installCodeBox');
  if(box){
    if(istOffizier(aktuellerBenutzer) && sbInviteCode){
      box.innerHTML = '<div class="install-code-box"><div class="t">Einladungscode deines Zuges</div><div class="code">'+escapeHtml(sbInviteCode)+'</div></div>';
    } else {
      box.innerHTML = '';
    }
  }
  document.getElementById('installSeite').classList.remove('hidden');
}
function installSeiteSchliessen(){ document.getElementById('installSeite').classList.add('hidden'); }

/* ============================================================
   TOASTS
   ============================================================ */
function showToast(text, typ='success'){
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast ' + typ;
  const icons = {success:'✅',error:'⛔',info:'ℹ️',warning:'⚠️'};
  t.innerHTML = '<span>'+(icons[typ]||'')+'</span><span>'+escapeHtml(text)+'</span>';
  c.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(380px)'; t.style.transition='all .3s ease'; setTimeout(()=>t.remove(),300); }, 3200);
}

/* ============================================================
   AUTH (Supabase)
   ============================================================ */
let authModus = 'login'; // 'login' | 'register'

function zustandSetzen(zustand){
  document.getElementById('ladeAnzeige').classList.toggle('hidden', zustand !== 'laden');
  document.getElementById('authCard').classList.toggle('hidden', zustand !== 'auth');
  document.getElementById('onboardingCard').classList.toggle('hidden', zustand !== 'onboarding');

  const istApp = zustand === 'app';
  document.getElementById('sidebar').classList.toggle('hidden', !istApp);
  document.getElementById('tabbar').classList.toggle('hidden', !istApp);
  document.getElementById('topbarMenu').classList.toggle('hidden', !istApp);
  document.getElementById('footerBar')?.classList.toggle('hidden', zustand !== 'auth');

  if(!istApp){
    document.querySelectorAll('.app-seite').forEach(el => el.classList.add('hidden'));
  }
}

function authModeToggle(){
  authModus = authModus === 'login' ? 'register' : 'login';
  const anmelden = authModus === 'login';
  document.getElementById('authTitel').textContent  = anmelden ? 'Anmelden' : 'Registrieren';
  document.getElementById('authBtn').textContent    = anmelden ? 'Einloggen' : 'Registrieren';
  document.getElementById('authToggleBtn').textContent = anmelden
    ? 'Noch kein Konto? Registrieren' : 'Bereits ein Konto? Einloggen';
  document.getElementById('authPasswort').autocomplete = anmelden ? 'current-password' : 'new-password';
}

async function authAktion(){
  const email = document.getElementById('authEmail').value.trim();
  const pw    = document.getElementById('authPasswort').value;
  if(!email || !pw){ showToast('E-Mail und Passwort eingeben','error'); return; }

  const btn = document.getElementById('authBtn');
  btn.disabled = true;
  try{
    if(authModus === 'login'){
      const { error } = await sb.auth.signInWithPassword({ email, password: pw });
      if(error) throw error;
    } else {
      const { error } = await sb.auth.signUp({ email, password: pw });
      if(error) throw error;
      showToast('Registrierung erfolgreich – bitte E-Mail bestätigen falls nötig.','info');
    }
  } catch(e){
    const msg = {
      'Invalid login credentials': 'E-Mail oder Passwort falsch.',
      'User already registered': 'Diese E-Mail ist bereits registriert.',
      'Password should be at least 6 characters': 'Passwort muss mindestens 6 Zeichen haben.',
    }[e.message] || e.message;
    showToast(msg,'error');
  } finally {
    btn.disabled = false;
  }
}

async function onboardingGruenden(){
  const club_name = document.getElementById('obVereinsname').value.trim();
  const mein_name = document.getElementById('obMeinName').value.trim();
  if(!club_name || !mein_name){ showToast('Vereinsname und Name eingeben','error'); return; }
  const { error } = await sb.rpc('create_club', { club_name, mein_name });
  if(error){ showToast(error.message || 'Fehler beim Gründen','error'); return; }
  showToast('Verein „' + club_name + '" gegründet!');
  await checkAppState();
}

async function onboardingBeitreten(){
  const code      = document.getElementById('obCode').value.trim();
  const mein_name = document.getElementById('obBeitretenName').value.trim();
  if(!code || !mein_name){ showToast('Code und Name eingeben','error'); return; }
  const { error } = await sb.rpc('join_club', { code, mein_name });
  if(error){ showToast(error.message || 'Ungültiger Einladungscode','error'); return; }
  showToast('Dem Verein beigetreten!');
  await checkAppState();
}

async function ausloggen(){
  realtimeStoppen();
  await sb.auth.signOut();
  aktuellerBenutzer = null;
  sbSession = null; sbClubId = null; sbClubName = null; sbInviteCode = null;
  showToast('Abgemeldet','info');
}

async function checkAppState(){
  zustandSetzen('laden');
  try{
    const { data: { session } } = await sb.auth.getSession();
    sbSession = session;

    if(!session){
      aktuellerBenutzer = null;
      sbClubId = null; sbClubName = null; sbInviteCode = null;
      zustandSetzen('auth');
      return;
    }

    const { data: clubId } = await sb.rpc('my_club_id');
    sbClubId = clubId;

    if(!clubId){
      zustandSetzen('onboarding');
      return;
    }

    const [roleRes, memberRes, clubRes] = await Promise.all([
      sb.rpc('my_role'),
      sb.from('members').select('name, role').eq('user_id', session.user.id).maybeSingle(),
      sb.from('clubs').select('name, invite_code').eq('id', clubId).single()
    ]);

    const memberName = memberRes.data?.name || session.user.email;
    const memberRole = roleRes.data || memberRes.data?.role || 'Schütze';
    sbClubName   = clubRes.data?.name        || 'Schützenverein';
    sbInviteCode = clubRes.data?.invite_code || '';

    aktuellerBenutzer = {
      id: 'sb-' + session.user.id,
      name: memberName, rolle: memberRole,
      aktiv: true, bild: '', benutzername: session.user.email, passwort: '', email: session.user.email
    };
    zugname = sbClubName;

    zustandSetzen('app');
    seiteAnzeigen('dashboard');
    await clubDatenLaden();
    realtimeStarten();
  } catch(e){
    console.error('checkAppState:', e);
    zustandSetzen('auth');
  }
}

/* ============================================================
   CLUB-DATEN LADEN (Supabase)
   ============================================================ */
async function clubDatenLaden(){
  try{
    const [membersRes, startenRes, strafenRes, anwRes, termineRes, saisonsRes, clubRes, umfragenRes, optionenRes, stimmenRes, kasseRes] = await Promise.all([
      sb.from('members').select('*'),
      sb.from('strafarten').select('*'),
      sb.from('strafen').select('*'),
      sb.from('anwesenheiten').select('*'),
      sb.from('termine').select('*'),
      sb.from('saisons').select('*'),
      sb.from('clubs').select('custom_badge_types, logo').eq('id', sbClubId).single(),
      sb.from('umfragen').select('*'),
      sb.from('umfrage_optionen').select('*'),
      sb.from('umfrage_stimmen').select('*'),
      sb.from('kassenbuchungen').select('*')
    ]);

    customBadgeTypes = clubRes.data?.custom_badge_types || [];
    logo = clubRes.data?.logo || '';

    schuetzen = (membersRes.data || []).map(m => ({
      id: m.id, name: m.name, rolle: m.role,
      bild: m.bild || '', email: m.email || '',
      aktiv: m.aktiv ?? true, user_id: m.user_id,
      awarded_custom_badges: m.awarded_custom_badges || []
    }));

    strafarten = startenRes.data || [];

    strafen = (strafenRes.data || []).map(x => ({
      ...x,
      schuetzeId: x.member_id,
      bezahltArt: x.bezahlt_art || '',
      bezahltDatum: x.bezahlt_datum || ''
    }));

    anwesenheiten = (anwRes.data || []).map(x => ({
      ...x,
      schuetzeId: x.member_id
    }));

    termine = termineRes.data || [];
    saisons = (saisonsRes.data || []).map(s => ({
      ...s,
      daten: s.daten || { strafen: [], anwesenheiten: [], summary: {} }
    }));

    umfragen        = umfragenRes.data  || [];
    umfrageOptionen = optionenRes.data  || [];
    umfrageStimmen  = stimmenRes.data   || [];
    kassenbuchungen = kasseRes.data     || [];

    appAktualisieren();
  } catch(e){
    console.error('clubDatenLaden:', e);
    showToast('Vereinsdaten konnten nicht geladen werden', 'error');
  }
}

/* ============================================================
   INDIVIDUELLE ABZEICHEN
   ============================================================ */
async function customBadgeHinzufuegen(){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const emoji = document.getElementById('customBadgeEmoji').value.trim();
  const name  = document.getElementById('customBadgeName').value.trim();
  if(!emoji || !name){ showToast('Emoji und Name eingeben','error'); return; }
  const neueTypes = [...customBadgeTypes, { id: neueId(), emoji, name }];
  const { error } = await sb.from('clubs').update({ custom_badge_types: neueTypes }).eq('id', sbClubId);
  if(error){ showToast('Fehler: ' + error.message, 'error'); return; }
  document.getElementById('customBadgeEmoji').value = '';
  document.getElementById('customBadgeName').value = '';
  showToast('Abzeichen-Typ „'+name+'" erstellt');
  await clubDatenLaden();
}

async function customBadgeLoeschen(id){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const neueTypes = customBadgeTypes.filter(b => b.id !== id);
  const { error } = await sb.from('clubs').update({ custom_badge_types: neueTypes }).eq('id', sbClubId);
  if(error){ showToast('Fehler: ' + error.message, 'error'); return; }
  showToast('Abzeichen-Typ gelöscht','warning');
  await clubDatenLaden();
}

async function customBadgeVerleihen(memberId, badgeId){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const s = findSchuetze(memberId); if(!s) return;
  const vorhanden = (s.awarded_custom_badges||[]).some(b => b.badge_id === badgeId);
  if(vorhanden){ showToast('Bereits vergeben','info'); return; }
  const neu = [...(s.awarded_custom_badges||[]), { badge_id: badgeId, awarded_at: new Date().toISOString(), note: '' }];
  const { error } = await sb.from('members').update({ awarded_custom_badges: neu }).eq('id', memberId);
  if(error){ showToast('Fehler: ' + error.message, 'error'); return; }
  showToast('Abzeichen vergeben!');
  await clubDatenLaden();
}

async function customBadgeEntziehen(memberId, badgeId){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const s = findSchuetze(memberId); if(!s) return;
  const neu = (s.awarded_custom_badges||[]).filter(b => b.badge_id !== badgeId);
  const { error } = await sb.from('members').update({ awarded_custom_badges: neu }).eq('id', memberId);
  if(error){ showToast('Fehler: ' + error.message, 'error'); return; }
  showToast('Abzeichen entzogen','warning');
  await clubDatenLaden();
}

function abzeichenModalOeffnen(memberId){
  const s = findSchuetze(memberId); if(!s) return;
  const modal = document.getElementById('abzeichenModal');
  const inhalt = document.getElementById('abzeichenModalInhalt');
  if(!customBadgeTypes.length){
    inhalt.innerHTML = '<p class="leer">Noch keine Abzeichen-Typen erstellt. Gehe zu Einstellungen → Individuelle Abzeichen.</p>';
  } else {
    const vergeben = s.awarded_custom_badges || [];
    inhalt.innerHTML = '<p><b>'+escapeHtml(s.name)+'</b></p>' +
      customBadgeTypes.map(b => {
        const hat = vergeben.some(v => v.badge_id === b.id);
        return '<div class="badge-modal-row">'+
          '<span>'+escapeHtml(b.emoji)+' '+escapeHtml(b.name)+'</span>'+
          (hat
            ? '<button class="mini-btn delete-button" onclick="customBadgeEntziehen(\''+memberId+'\',\''+b.id+'\');abzeichenModalSchliessen()">Entziehen</button>'
            : '<button class="mini-btn btn-gold" onclick="customBadgeVerleihen(\''+memberId+'\',\''+b.id+'\');abzeichenModalSchliessen()">Vergeben</button>'
          )+'</div>';
      }).join('');
  }
  modal.classList.remove('hidden');
}

function abzeichenModalSchliessen(){
  document.getElementById('abzeichenModal')?.classList.add('hidden');
}

/* ============================================================
   MITGLIEDER
   ============================================================ */
async function schuetzeHinzufuegen(){
  if(!darfBearbeiten()){ showToast('Nur Offiziere dürfen Mitglieder anlegen','error'); return; }
  const name  = document.getElementById('neuerSchuetze').value.trim();
  const rolle = document.getElementById('rolleSelect').value;
  if(!name){ showToast('Name ist nötig','error'); return; }
  const { error } = await sb.from('members').insert({
    club_id: sbClubId, name, role: rolle, aktiv: true, bild: '', user_id: null
  });
  if(error){ console.error('schuetzeHinzufuegen:', error); showToast('Fehler: ' + error.message, 'error'); return; }
  document.getElementById('neuerSchuetze').value = '';
  showToast('Mitglied „'+name+'" hinzugefügt');
  await clubDatenLaden();
}
async function schuetzeLoeschen(id){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const s = findSchuetze(id); if(!s) return;
  if(!confirm('„'+s.name+'" wirklich löschen?')) return;
  const { error } = await sb.from('members').delete().eq('id', id);
  if(error){ console.error('schuetzeLoeschen:', error); showToast('Fehler: ' + error.message, 'error'); return; }
  showToast('Mitglied gelöscht','warning');
  await clubDatenLaden();
}
async function schuetzeAktivToggle(id){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const s = findSchuetze(id); if(!s) return;
  const { error } = await sb.from('members').update({ aktiv: !s.aktiv }).eq('id', id);
  if(error){ console.error('schuetzeAktivToggle:', error); showToast('Fehler: ' + error.message, 'error'); return; }
  await clubDatenLaden();
}
function mitgliedBildHochladen(id, input){
  const s = findSchuetze(id); if(!s || !input.files[0]) return;
  const r = new FileReader();
  r.onload = async e => {
    const bild = e.target.result;
    const { error } = await sb.from('members').update({ bild }).eq('id', id);
    if(error){ console.error('mitgliedBildHochladen:', error); showToast('Fehler: ' + error.message, 'error'); return; }
    showToast('Profilbild gespeichert');
    await clubDatenLaden();
  };
  r.readAsDataURL(input.files[0]);
}

/* ============================================================
   PROFIL bearbeiten (Modal) – früher kaputt, jetzt funktionsfähig
   ============================================================ */
function profilEditOeffnen(){
  if(!aktuellerBenutzer){ showToast('Bitte zuerst einloggen','info'); return; }
  document.getElementById('editName').value = aktuellerBenutzer.name || '';
  document.getElementById('editEmail').value = aktuellerBenutzer.email || '';
  document.getElementById('editOldPassword').value = '';
  document.getElementById('editNewPassword').value = '';
  document.getElementById('profilEditModal').classList.remove('hidden');
}
function closeProfilEditModal(){ document.getElementById('profilEditModal').classList.add('hidden'); }
async function saveProfilEdit(){
  if(!aktuellerBenutzer) return;
  const name = document.getElementById('editName').value.trim();
  const email= document.getElementById('editEmail').value.trim();
  const neuPw= document.getElementById('editNewPassword').value;
  if(!name){ showToast('Name darf nicht leer sein','error'); return; }
  const { error: memberErr } = await sb.from('members').update({ name, email }).eq('user_id', sbSession.user.id);
  if(memberErr){ console.error('saveProfilEdit:', memberErr); showToast('Fehler: ' + memberErr.message, 'error'); return; }
  if(neuPw){
    const { error: pwErr } = await sb.auth.updateUser({ password: neuPw });
    if(pwErr){ console.error('saveProfilEdit (Passwort):', pwErr); showToast('Passwort-Fehler: ' + pwErr.message, 'error'); return; }
  }
  closeProfilEditModal();
  showToast('Profil aktualisiert');
  await clubDatenLaden();
}
function eigenesBildHochladen(input){
  if(!aktuellerBenutzer || !input.files[0]) return;
  const r = new FileReader();
  r.onload = async e => {
    const bild = e.target.result;
    const { error } = await sb.from('members').update({ bild }).eq('user_id', sbSession.user.id);
    if(error){ console.error('eigenesBildHochladen:', error); showToast('Fehler: ' + error.message, 'error'); return; }
    aktuellerBenutzer.bild = bild;
    showToast('Profilbild gespeichert');
    await clubDatenLaden();
  };
  r.readAsDataURL(input.files[0]);
}

/* ============================================================
   STRAFARTEN
   ============================================================ */
async function strafartHinzufuegen(){
  if(!darfBearbeiten()){ showToast('Nur Offiziere dürfen Strafarten anlegen','error'); return; }
  const bezeichnung = document.getElementById('neueStrafart').value.trim();
  const betrag = parseFloat(document.getElementById('neuerBetrag').value);
  if(!bezeichnung || isNaN(betrag)){ showToast('Bezeichnung und Betrag nötig','error'); return; }
  const { error } = await sb.from('strafarten').insert({ club_id: sbClubId, bezeichnung, betrag });
  if(error){ console.error('strafartHinzufuegen:', error); showToast('Fehler: ' + error.message, 'error'); return; }
  document.getElementById('neueStrafart').value=''; document.getElementById('neuerBetrag').value='';
  showToast('Strafart hinzugefügt');
  await clubDatenLaden();
}
async function strafartLoeschen(id){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const { error } = await sb.from('strafarten').delete().eq('id', id);
  if(error){ console.error('strafartLoeschen:', error); showToast('Fehler: ' + error.message, 'error'); return; }
  await clubDatenLaden();
}

/* ============================================================
   STRAFEN
   ============================================================ */
function betragAktualisieren(){
  const i = document.getElementById('strafartSelect').value;
  const a = (i !== '') ? strafarten[parseInt(i)] : null;
  const betragEl   = document.getElementById('betrag');
  const betragInfo = document.getElementById('betragInfo');
  const overrideEl = document.getElementById('betragOverrideLink');
  if(a && betragEl){
    betragEl.value = a.betrag;
    betragEl.style.display = 'none';
    if(betragInfo){ betragInfo.style.display = 'block'; betragInfo.textContent = 'Betrag: ' + euro(a.betrag) + ' (aus Strafart)'; }
    if(overrideEl) overrideEl.style.display = 'block';
  } else if(betragEl){
    betragEl.style.display = '';
    if(betragInfo) betragInfo.style.display = 'none';
    if(overrideEl) overrideEl.style.display = 'none';
    betragEl.classList.remove('auto-betrag');
  }
}
function betragManuell(){
  document.getElementById('betrag')?.classList.remove('auto-betrag');
}
function betragUeberschreiben(){
  const betragEl   = document.getElementById('betrag');
  const betragInfo = document.getElementById('betragInfo');
  const overrideEl = document.getElementById('betragOverrideLink');
  if(betragEl) betragEl.style.display = '';
  if(betragInfo) betragInfo.style.display = 'none';
  if(overrideEl) overrideEl.style.display = 'none';
  betragEl?.focus();
}
async function strafeSpeichern(){
  if(!darfBearbeiten()){ showToast('Nur Offiziere dürfen Strafen erfassen','error'); return; }
  if(!sbClubId){
    console.error('strafeSpeichern: sbClubId ist null – Verein nicht geladen');
    showToast('Vereins-ID fehlt, bitte Seite neu laden', 'error');
    return;
  }
  const sid = document.getElementById('schuetzeSelect').value;
  const ai  = document.getElementById('strafartSelect').value;
  const basis = parseFloat(document.getElementById('betrag').value);
  const kommentar = document.getElementById('kommentar').value.trim();
  const s = findSchuetze(sid);
  if(!s || isNaN(basis)){ showToast('Schütze und Betrag wählen','error'); return; }
  const art = strafarten[ai] ? strafarten[ai].bezeichnung : 'Strafe';
  const endbetrag = istOffizier(s) ? basis*2 : basis;  // Offiziere zahlen doppelt
  console.log('strafeSpeichern Insert:', { club_id: sbClubId, member_id: s.id, schuetze: s.name });
  const { error } = await sb.from('strafen').insert({
    club_id: sbClubId, member_id: s.id, schuetze: s.name, strafart: art,
    basisbetrag: basis, betrag: endbetrag, kommentar,
    datum: new Date().toISOString().slice(0,10), bezahlt: false
  });
  if(error){
    console.error('strafeSpeichern fehlgeschlagen:', error);
    showToast('Speichern fehlgeschlagen: ' + error.message, 'error');
    return;
  }
  document.getElementById('kommentar').value='';
  showToast('Strafe gespeichert' + (istOffizier(s)?' (Offizier × 2)':''));
  await clubDatenLaden();
}
async function strafeLoeschen(id){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const { error } = await sb.from('strafen').delete().eq('id', id);
  if(error){
    console.error('strafeLoeschen fehlgeschlagen:', error);
    showToast('Löschen fehlgeschlagen: ' + error.message, 'error');
    return;
  }
  showToast('Strafe gelöscht','warning');
  await clubDatenLaden();
}
/* ---------- Offene Beträge teilen ---------- */
async function offeneBetraegeTeilen(){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const summenMap = {};
  strafen.filter(x => !x.bezahlt).forEach(x => {
    summenMap[x.schuetze] = (summenMap[x.schuetze] || 0) + x.betrag;
  });
  const eintraege = Object.entries(summenMap).filter(([,v]) => v > 0).sort((a,b) => b[1] - a[1]);
  if(!eintraege.length){ showToast('Aktuell sind keine Beträge offen 🎉','info'); return; }
  const gesamt = eintraege.reduce((a,[,v]) => a + v, 0);
  const fmt = n => n.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
  const datum = new Date().toLocaleDateString('de-DE');
  const text = 'Offene Strafen – ' + zugname + ' (Stand ' + datum + ')\n\n' +
    eintraege.map(([name,betrag]) => name + ': ' + fmt(betrag)).join('\n') +
    '\n\nGesamt offen: ' + fmt(gesamt) + '\nBitte zeitnah begleichen – danke! 🍺';
  if(navigator.share){
    try { await navigator.share({ text }); }
    catch(e){ if(e.name !== 'AbortError') showToast('Teilen fehlgeschlagen: ' + e.message,'error'); }
  } else {
    try { await navigator.clipboard.writeText(text); showToast('In Zwischenablage kopiert ✓'); }
    catch(e){ showToast('Kopieren fehlgeschlagen','error'); }
  }
}

/* ---------- Mehrfach-Erfassung ---------- */
let mehrfachAusgewaehlt = new Set();

function mehrfachChipToggle(btn){
  const id = btn.dataset.id;
  if(mehrfachAusgewaehlt.has(id)){ mehrfachAusgewaehlt.delete(id); btn.classList.remove('aktiv'); }
  else { mehrfachAusgewaehlt.add(id); btn.classList.add('aktiv'); }
}

function mehrfachBetragAktualisieren(){
  const i = document.getElementById('mehrfachStrafartSelect').value;
  const a = (i !== '') ? strafarten[parseInt(i)] : null;
  const betragEl   = document.getElementById('mehrfachBetrag');
  const betragInfo = document.getElementById('mehrfachBetragInfo');
  if(a && betragEl){
    betragEl.value = a.betrag;
    betragEl.style.display = 'none';
    if(betragInfo){ betragInfo.style.display = 'block'; betragInfo.textContent = 'Betrag: ' + euro(a.betrag) + ' (aus Strafart)'; }
  } else if(betragEl){
    betragEl.style.display = '';
    if(betragInfo) betragInfo.style.display = 'none';
  }
}

async function mehrfachStrafeSpeichern(){
  if(!darfBearbeiten()){ showToast('Nur Offiziere dürfen Strafen erfassen','error'); return; }
  if(!mehrfachAusgewaehlt.size){ showToast('Mindestens einen Schützen auswählen','error'); return; }
  const ai = document.getElementById('mehrfachStrafartSelect').value;
  const basis = parseFloat(document.getElementById('mehrfachBetrag').value);
  const kommentar = document.getElementById('mehrfachKommentar').value.trim();
  if(isNaN(basis) || basis <= 0){ showToast('Betrag eingeben','error'); return; }
  const art = strafarten[ai] ? strafarten[ai].bezeichnung : 'Strafe';
  const datum = new Date().toISOString().slice(0,10);
  const eintraege = [...mehrfachAusgewaehlt].map(id => {
    const s = findSchuetze(id); if(!s) return null;
    return { club_id: sbClubId, member_id: s.id, schuetze: s.name, strafart: art,
      basisbetrag: basis, betrag: istOffizier(s) ? basis*2 : basis, kommentar, datum, bezahlt: false };
  }).filter(Boolean);
  if(!eintraege.length){ showToast('Keine gültigen Mitglieder','error'); return; }
  const { error } = await sb.from('strafen').insert(eintraege);
  if(error){ console.error(error); showToast('Fehler: ' + error.message,'error'); return; }
  mehrfachAusgewaehlt = new Set();
  document.getElementById('mehrfachKommentar').value = '';
  showToast(eintraege.length + (eintraege.length === 1 ? ' Strafe' : ' Strafen') + ' erfasst');
  await clubDatenLaden();
}

let zahlungStrafeId = null;
async function strafeBezahltToggle(id){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const st = strafen.find(x => x.id === id); if(!st) return;
  if(st.bezahlt){
    // bereits bezahlt -> wieder auf offen, Vermerk entfernen
    const { error } = await sb.from('strafen').update({ bezahlt: false, bezahlt_art: null, bezahlt_datum: null }).eq('id', id);
    if(error){
      console.error('strafeBezahltToggle (offen) fehlgeschlagen:', error);
      showToast('Fehler: ' + error.message, 'error');
      return;
    }
    await clubDatenLaden();
  } else {
    // Bezahl-Fenster öffnen, um Art + Datum zu erfassen
    zahlungStrafeId = id;
    document.getElementById('zahlungArt').value = 'Bar';
    document.getElementById('zahlungDatum').value = new Date().toISOString().slice(0,10);
    document.getElementById('zahlungModal').classList.remove('hidden');
  }
}
function closeZahlungModal(){ zahlungStrafeId = null; document.getElementById('zahlungModal').classList.add('hidden'); }
async function zahlungSpeichern(){
  if(!zahlungStrafeId){ closeZahlungModal(); return; }
  const art   = document.getElementById('zahlungArt').value;
  const datum = document.getElementById('zahlungDatum').value || new Date().toISOString().slice(0,10);
  const { error } = await sb.from('strafen').update({ bezahlt: true, bezahlt_art: art, bezahlt_datum: datum }).eq('id', zahlungStrafeId);
  if(error){
    console.error('zahlungSpeichern fehlgeschlagen:', error);
    showToast('Zahlung speichern fehlgeschlagen: ' + error.message, 'error');
    return;
  }
  closeZahlungModal();
  showToast('Als bezahlt vermerkt ('+art+')');
  await clubDatenLaden();
}

/* ============================================================
   ANWESENHEIT
   ============================================================ */
async function anwesenheitSpeichern(){
  if(!darfBearbeiten()){ showToast('Nur Offiziere dürfen Anwesenheit erfassen','error'); return; }
  const tag    = document.getElementById('tagSelect').value;
  const sid    = document.getElementById('anwesenheitSchuetzeSelect').value;
  const status = document.getElementById('statusSelect').value;
  const minuten = parseInt(document.getElementById('verspaetungMinuten').value) || 0;
  const anwKommentar = document.getElementById('anwesenheitKommentar')?.value.trim() || '';
  const s = findSchuetze(sid);
  if(!s){ showToast('Bitte Schütze auswählen','error'); return; }

  const datum = new Date().toISOString().slice(0,10);

  const { error: anwErr } = await sb.from('anwesenheiten').insert({
    club_id: sbClubId, member_id: s.id, schuetze: s.name,
    tag, status, minuten, datum, kommentar: anwKommentar
  });
  if(anwErr){ console.error('anwesenheitSpeichern:', anwErr); showToast('Fehler: ' + anwErr.message, 'error'); return; }

  // Automatische „Zu spät"-Strafe (Betrag aus Strafenkatalog, Rückfall 5 €, Offiziere doppelt)
  if(status === 'Zu spät'){
    const zuSpaetArt = strafarten.find(a => a.bezeichnung === 'Zu spät erschienen');
    const basis = zuSpaetArt ? zuSpaetArt.betrag : 5;
    const betrag = istOffizier(s) ? basis * 2 : basis;
    const { error: strafErr } = await sb.from('strafen').insert({
      club_id: sbClubId, member_id: s.id, schuetze: s.name,
      strafart: 'Zu spät erschienen', basisbetrag: basis, betrag,
      kommentar: minuten ? minuten + ' Min. Verspätung' : '',
      datum, bezahlt: false
    });
    if(strafErr){ console.error('anwesenheitSpeichern (Strafe):', strafErr); showToast('Anwesenheit gespeichert, Strafe fehlgeschlagen: ' + strafErr.message, 'error'); }
    else { showToast('Anwesenheit + automatische Verspätungs-Strafe gespeichert', 'info'); }
  } else {
    showToast('Anwesenheit gespeichert');
  }

  document.getElementById('verspaetungMinuten').value = '';
  if(document.getElementById('anwesenheitKommentar')) document.getElementById('anwesenheitKommentar').value = '';
  await clubDatenLaden();
}
async function anwesenheitLoeschen(id){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const { error } = await sb.from('anwesenheiten').delete().eq('id', id);
  if(error){ console.error('anwesenheitLoeschen:', error); showToast('Fehler: ' + error.message, 'error'); return; }
  showToast('Eintrag gelöscht','warning');
  await clubDatenLaden();
}

function renderSchnellErfassung(){
  const bereich = document.getElementById('schnellErfassungBereich');
  if(!bereich) return;
  if(!darfBearbeiten()){ bereich.classList.add('hidden'); return; }
  bereich.classList.remove('hidden');

  const datumInput = document.getElementById('schnellDatum');
  if(datumInput && !datumInput.value) datumInput.value = new Date().toISOString().slice(0,10);

  const aktive = schuetzen.filter(s=>s.aktiv);
  const liste = document.getElementById('schnellMitgliederListe');
  if(!liste) return;
  liste.innerHTML = aktive.map(s=>
    '<div class="schnell-zeile" data-id="'+s.id+'">' +
      '<span class="schnell-name">'+escapeHtml(s.name)+'</span>' +
      '<div class="status-seg">' +
        '<button type="button" class="seg-btn" data-status="Anwesend" onclick="schnellStatusWaehlen(this)">Anwesend</button>' +
        '<button type="button" class="seg-btn" data-status="Zu spät" onclick="schnellStatusWaehlen(this)">Zu spät</button>' +
        '<button type="button" class="seg-btn" data-status="Entschuldigt" onclick="schnellStatusWaehlen(this)">Entschuldigt</button>' +
        '<button type="button" class="seg-btn" data-status="Fehlend" onclick="schnellStatusWaehlen(this)">Fehlend</button>' +
      '</div>' +
      '<input class="schnell-min hidden" type="number" placeholder="Min." min="0">' +
    '</div>'
  ).join('') || '<p class="muted">Keine aktiven Mitglieder.</p>';
}

function schnellStatusWaehlen(btn){
  const zeile = btn.closest('.schnell-zeile');
  const war = btn.classList.contains('seg-aktiv');
  zeile.querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('seg-aktiv'));
  const minInput = zeile.querySelector('.schnell-min');
  if(!war){
    btn.classList.add('seg-aktiv');
    if(btn.dataset.status === 'Zu spät'){ minInput.classList.remove('hidden'); }
    else { minInput.classList.add('hidden'); minInput.value = ''; }
  } else {
    minInput.classList.add('hidden'); minInput.value = '';
  }
}

async function schnellAnwesenheitSpeichern(){
  if(!darfBearbeiten()){ showToast('Nur Offiziere dürfen Anwesenheit erfassen','error'); return; }
  const datum = document.getElementById('schnellDatum').value || new Date().toISOString().slice(0,10);
  const tag   = document.getElementById('schnellTag').value;
  const zeilen = document.querySelectorAll('#schnellMitgliederListe .schnell-zeile');
  const eintraege = [];
  const verspaetete = [];
  zeilen.forEach(zeile=>{
    const aktiv = zeile.querySelector('.seg-btn.seg-aktiv');
    if(!aktiv) return;
    const s = findSchuetze(zeile.dataset.id);
    if(!s) return;
    const status  = aktiv.dataset.status;
    const minuten = status === 'Zu spät' ? (parseInt(zeile.querySelector('.schnell-min').value)||0) : 0;
    eintraege.push({ club_id:sbClubId, member_id:s.id, schuetze:s.name, tag, status, minuten, datum });
    if(status === 'Zu spät') verspaetete.push({ s, minuten });
  });
  if(eintraege.length === 0){ showToast('Kein Status ausgewählt','error'); return; }

  const { error: anwErr } = await sb.from('anwesenheiten').insert(eintraege);
  if(anwErr){ console.error('schnellAnwesenheitSpeichern:', anwErr); showToast('Fehler: '+anwErr.message,'error'); return; }

  if(verspaetete.length > 0){
    const zuSpaetArt = strafarten.find(a => a.bezeichnung === 'Zu spät erschienen');
    const basis = zuSpaetArt ? zuSpaetArt.betrag : 5;
    const strafEintraege = verspaetete.map(({s, minuten})=>({
      club_id:sbClubId, member_id:s.id, schuetze:s.name,
      strafart:'Zu spät erschienen', basisbetrag:basis,
      betrag: istOffizier(s) ? basis*2 : basis,
      kommentar: minuten ? minuten+' Min. Verspätung' : '',
      datum, bezahlt:false
    }));
    const { error: strafErr } = await sb.from('strafen').insert(strafEintraege);
    if(strafErr){ console.error('schnellAnwesenheitSpeichern (Strafen):', strafErr); showToast(eintraege.length+' Anwesenheit(en) gespeichert, Strafen fehlgeschlagen: '+strafErr.message,'error'); }
    else { showToast(eintraege.length+' Anwesenheit(en) + '+verspaetete.length+' Verspätungs-Strafe(n) gespeichert','info'); }
  } else {
    showToast(eintraege.length+' Anwesenheit(en) gespeichert');
  }
  await clubDatenLaden();
}

/* ============================================================
   KALENDER
   ============================================================ */
async function terminSpeichern(){
  if(!darfBearbeiten()){ showToast('Nur Offiziere dürfen Termine anlegen','error'); return; }
  const titel = document.getElementById('terminTitel').value.trim();
  const datum = document.getElementById('terminDatum').value;
  const zeit  = document.getElementById('terminZeit').value;
  const ort   = document.getElementById('terminOrt').value.trim();
  const hinweis = document.getElementById('terminHinweis').value.trim();
  const antreten = document.getElementById('terminAntreten').checked;
  if(!titel || !datum){ showToast('Titel und Datum sind nötig','error'); return; }
  const { error } = await sb.from('termine').insert({
    club_id: sbClubId, titel, datum, zeit, ort, hinweis, antreten
  });
  if(error){ console.error('terminSpeichern:', error); showToast('Fehler: ' + error.message, 'error'); return; }
  ['terminTitel','terminOrt','terminHinweis'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('terminDatum').value=''; document.getElementById('terminZeit').value='';
  showToast('Termin gespeichert');
  await clubDatenLaden();
}
async function terminLoeschen(id){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const { error } = await sb.from('termine').delete().eq('id', id);
  if(error){ console.error('terminLoeschen:', error); showToast('Fehler: ' + error.message, 'error'); return; }
  showToast('Termin gelöscht','warning');
  await clubDatenLaden();
}
function naechsterTermin(){
  const heute = new Date().toISOString().slice(0,10);
  return termine.filter(t => t.datum >= heute).sort((a,b)=> (a.datum+a.zeit).localeCompare(b.datum+b.zeit))[0] || null;
}
function datumKurz(iso){
  const d = new Date(iso+'T00:00:00');
  return { tag:d.getDate(), monat:d.toLocaleDateString('de-DE',{month:'short'}), lang:d.toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'long'}) };
}

/* ============================================================
   STATISTIK & GAMIFICATION
   ============================================================ */
function statsFuer(s){
  const eigene = strafen.filter(x => x.schuetzeId === s.id);
  const anw = anwesenheiten.filter(x => x.schuetzeId === s.id);
  return {
    gesamt: eigene.reduce((a,x)=>a+x.betrag,0),
    offen:  eigene.filter(x=>!x.bezahlt).reduce((a,x)=>a+x.betrag,0),
    bezahlt:eigene.filter(x=> x.bezahlt).reduce((a,x)=>a+x.betrag,0),
    anzahl: eigene.length,
    anwesend: anw.filter(x=>x.status==='Anwesend').length,
    anwGesamt: anw.length
  };
}
function rankingListe(){
  return schuetzen.filter(s=>s.aktiv)
    .map(s => ({ s, ...statsFuer(s) }))
    .sort((a,b)=> b.gesamt - a.gesamt);
}
function maxAnzahl(){ return Math.max(0, ...schuetzen.map(s=>statsFuer(s).anzahl)); }

function titelFuer(s){
  const rang = rankingListe();
  const platz = rang.findIndex(r => r.s.id === s.id);
  const st = statsFuer(s);
  if(platz === 0 && st.gesamt > 0) return '👑 König der Zugsauen';
  if(platz >= 0 && platz <= 2 && st.gesamt > 0) return '🐷 Zugsau';
  if(st.anzahl > 0 && st.anzahl === maxAnzahl()) return '🍺 Bierkönig';
  if(st.anwesend >= 5) return '🔥 Serienmeister';
  if(st.offen === 0 && st.bezahlt > 0) return '🏅 Ehrenmann';
  return '🎖️ ' + (s.rolle || 'Schütze');
}

const ABZEICHEN = [
  { id:'koenig',       e:'👑', name:'König',         tipp:'Du hast die höchste Strafsumme im ganzen Zug.',                               pruef:(st,p)=> p===0 && st.gesamt>0 },
  { id:'zugsau',       e:'🐷', name:'Zugsau',        tipp:'Du bist unter den Top 3 mit der höchsten Strafsumme.',                        pruef:(st,p)=> p>=0 && p<=2 && st.gesamt>0 },
  { id:'bierkoenig',   e:'🍺', name:'Bierkönig',     tipp:'Du hast die meisten Einzel-Strafen kassiert.',                                pruef:(st)=> st.anzahl>0 && st.anzahl===maxAnzahl() },
  { id:'serienmeister',e:'🔥', name:'Serienmeister', tipp:'Du warst 5-mal oder öfter pünktlich anwesend.',                               pruef:(st)=> st.anwesend>=5 },
  { id:'ehrenmann',    e:'🏅', name:'Ehrenmann',     tipp:'Alle deine Strafen sind bezahlt – kein einziger offener Betrag.',             pruef:(st)=> st.offen===0 && st.bezahlt>0 },
  { id:'stammgast',    e:'📅', name:'Stammgast',     tipp:'Du warst 10-mal oder öfter anwesend.',                                        pruef:(st)=> st.anwGesamt>=10 },
  { id:'makellos',     e:'💎', name:'Makellos',      tipp:'Noch keine einzige Strafe und mindestens 3-mal anwesend.',                    pruef:(st)=> st.anzahl===0 && st.anwGesamt>=3 },
  { id:'zahlmeister',  e:'💰', name:'Zahlmeister',   tipp:'Du hast mindestens eine Strafe vollständig bezahlt.',                         pruef:(st)=> st.bezahlt>0 }
];
function abzeichenFuer(s){
  const rang = rankingListe();
  const platz = rang.findIndex(r => r.s.id === s.id);
  const st = statsFuer(s);
  const deaktiviert = customBadgeTypes.filter(b => b.type === 'disabled_auto').map(b => b.id);
  return ABZEICHEN
    .filter(b => !deaktiviert.includes(b.id))
    .map(b => ({ ...b, hat: b.pruef(st, platz) }));
}

async function autoAbzeichenToggle(id){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const istDeaktiviert = customBadgeTypes.some(b => b.type === 'disabled_auto' && b.id === id);
  const neueTypes = istDeaktiviert
    ? customBadgeTypes.filter(b => !(b.type === 'disabled_auto' && b.id === id))
    : [...customBadgeTypes, { type: 'disabled_auto', id }];
  const { error } = await sb.from('clubs').update({ custom_badge_types: neueTypes }).eq('id', sbClubId);
  if(error){ showToast('Fehler: ' + error.message, 'error'); return; }
  await clubDatenLaden();
}

/* ============================================================
   RENDERN
   ============================================================ */
function appAktualisieren(){
  // Kopf / Zugname
  document.getElementById('topbarZugname').textContent = zugname;
  document.getElementById('sidebarZugname').textContent = zugname;

  // Logo in Topbar und Sidebar
  const topbarWappen = document.getElementById('topbarWappen');
  const topbarLogo   = document.getElementById('topbarLogo');
  const sidebarWappen= document.getElementById('sidebarWappen');
  const sidebarLogo  = document.getElementById('sidebarLogo');
  if(logo){
    topbarWappen?.classList.add('hidden');
    if(topbarLogo){ topbarLogo.src = logo; topbarLogo.classList.remove('hidden'); }
    sidebarWappen?.classList.add('hidden');
    if(sidebarLogo){ sidebarLogo.src = logo; sidebarLogo.classList.remove('hidden'); }
  } else {
    topbarWappen?.classList.remove('hidden');
    topbarLogo?.classList.add('hidden');
    sidebarWappen?.classList.remove('hidden');
    sidebarLogo?.classList.add('hidden');
  }
  document.getElementById('dashboardDatum').textContent = new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  // Sidebar-Login-Box: Verein, Rolle, Einladungscode (Spieß), Abmelden
  const slb = document.getElementById('sidebarLogin');
  if(aktuellerBenutzer){
    const codeHtml = (istOffizier(aktuellerBenutzer) && sbInviteCode)
      ? '<div style="margin:6px 0 2px">Einladungscode:<br><span class="code-display">'+escapeHtml(sbInviteCode)+'</span></div>' : '';
    slb.innerHTML =
      escapeHtml(sbClubName || zugname)+'<br>'+
      '<b>'+escapeHtml(aktuellerBenutzer.name)+'</b> · '+escapeHtml(aktuellerBenutzer.rolle)+
      codeHtml+
      '<button onclick="ausloggen()">Abmelden</button>';
  } else {
    slb.innerHTML = 'Nicht angemeldet';
  }

  // Einladungscode in Einstellungen (P3)
  const ecb = document.getElementById('einladungscodeBereich');
  if(ecb){
    if(istOffizier(aktuellerBenutzer) && sbInviteCode){
      ecb.classList.remove('hidden');
      ecb.innerHTML = '<h3>🔗 Einladungscode</h3>'+
        '<div style="display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap">'+
        '<span style="font-size:26px;font-weight:800;letter-spacing:3px;color:var(--gold);font-family:monospace">'+escapeHtml(sbInviteCode)+'</span>'+
        '<button class="btn-gold" style="width:auto;padding:8px 18px" onclick="einladungscodeKopieren()">Kopieren</button>'+
        '</div>';
    } else {
      ecb.classList.add('hidden');
    }
  }

  renderDashboard();
  renderProfil();
  renderStrafen();
  renderKalender();
  renderRanking();
  renderMitglieder();
  renderStrafarten();
  renderAnwesenheit();
  renderSelects();
  renderSaisons();
  renderCustomBadgeSettings();
  renderHilfe();
  renderAbstimmungen();
  renderChronik();
  renderKasse();
  renderEinstellungen();
  // Einstellungen-Felder
  document.getElementById('zugnameInput').value = zugname;
}

function renderDashboard(){
  const ziel = document.getElementById('dashboardInhalt');
  if(!ziel) return;

  const datum = new Date().toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const vorname = aktuellerBenutzer ? aktuellerBenutzer.name.split(' ')[0] : '';
  const logoHtml = logo
    ? '<img src="'+escapeHtml(logo)+'" class="db-kopf-logo" alt="Logo">'
    : '<svg style="width:44px;height:44px;flex:none" viewBox="0 0 100 116"><use href="#appWappen"/></svg>';

  const kopfHtml = '<div class="db-kopf">'+logoHtml+
    '<div><div class="db-kopf-zugname">'+escapeHtml(zugname||'Mein Zug')+'</div>'+
    (vorname?'<div class="db-kopf-gruss">Moin, '+escapeHtml(vorname)+' 👋</div>':'')+'</div>'+
    '<span style="margin-left:auto;font-size:12px;color:var(--ink-soft);text-align:right;flex:none">'+datum+'</span>'+
    '</div>';

  // Hero-Karte
  let heroLabel, heroZahl, heroInfo;
  if(istOffizier(aktuellerBenutzer)){
    const offenSum    = strafen.filter(x=>!x.bezahlt).reduce((a,x)=>a+x.betrag,0);
    const offenAnzahl = strafen.filter(x=>!x.bezahlt).length;
    heroLabel = 'Offene Strafen im Zug';
    heroZahl  = euro(offenSum);
    heroInfo  = offenAnzahl+(offenAnzahl===1?' offener Posten':' offene Posten');
  } else {
    const meinMember = sbSession ? schuetzen.find(s=>s.user_id===sbSession.user.id) : null;
    const st = meinMember ? statsFuer(meinMember) : {offen:0};
    heroLabel = 'Meine offenen Strafen';
    heroZahl  = euro(st.offen);
    heroInfo  = '';
  }

  const heroHtml = '<div class="db-hero" onclick="seiteAnzeigen(\'strafen\')">'+
    '<div class="db-hero-label">'+escapeHtml(heroLabel)+'</div>'+
    '<div><div class="db-hero-zahl">'+heroZahl+'</div></div>'+
    (heroInfo?'<div class="db-hero-info">'+escapeHtml(heroInfo)+'</div>':'')+
    '</div>';

  // Zwei Mini-Karten
  let m1l,m1z,m2l,m2z;
  if(istOffizier(aktuellerBenutzer)){
    const meinMember = sbSession ? schuetzen.find(s=>s.user_id===sbSession.user.id) : null;
    const meinSt = meinMember ? statsFuer(meinMember) : {offen:0};
    const bezahltGes = strafen.filter(x=>x.bezahlt).reduce((a,x)=>a+x.betrag,0);
    m1l='Meine offen';      m1z=euro(meinSt.offen);
    m2l='Bezahlt gesamt';   m2z=euro(bezahltGes);
  } else {
    const meinMember = sbSession ? schuetzen.find(s=>s.user_id===sbSession.user.id) : null;
    const st = meinMember ? statsFuer(meinMember) : {gesamt:0,offen:0};
    m1l='Meine Strafen gesamt'; m1z=euro(st.gesamt);
    m2l='Davon offen';          m2z=euro(st.offen);
  }

  const miniHtml = '<div class="db-mini-grid">'+
    '<div class="db-mini-card" onclick="seiteAnzeigen(\'profil\')">'+
      '<div class="db-mini-label">'+escapeHtml(m1l)+'</div>'+
      '<div class="db-mini-zahl">'+m1z+'</div>'+
    '</div>'+
    '<div class="db-mini-card" onclick="seiteAnzeigen(\'strafen\')">'+
      '<div class="db-mini-label">'+escapeHtml(m2l)+'</div>'+
      '<div class="db-mini-zahl">'+m2z+'</div>'+
    '</div>'+
    '</div>';

  // Podium-Karte
  const top3 = rankingListe().filter(r=>r.gesamt>0).slice(0,3);
  let podiumRows = top3.length===0 ? '<p class="leer">Noch keine Strafen erfasst.</p>' :
    top3.map((r,i)=>{
      const ini = r.s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      return '<div class="podium-zeile-row'+(i===0?' platz1':'')+'">'+
        '<div class="pz-rang">'+(i+1)+'</div>'+
        '<div class="mini-avatar'+(i===0?' gold':'')+'">'+escapeHtml(ini)+'</div>'+
        '<div class="pz-name">'+escapeHtml(r.s.name)+(i===0?' 👑':'')+'</div>'+
        '<div class="pz-sum">'+euro(r.gesamt)+'</div>'+
      '</div>';
    }).join('');

  const podiumKarteHtml = '<div class="card" style="margin-bottom:14px;cursor:pointer" onclick="seiteAnzeigen(\'ranking\')">'+
    '<div class="mini-label mb-10">🐷 Zugsau-Ranking</div>'+
    '<div class="podium-zeilen">'+podiumRows+'</div>'+
    '</div>';

  // Nächstes Antreten
  const nt = naechsterTermin();
  let terminKarteHtml;
  if(nt){
    const d = datumKurz(nt.datum);
    terminKarteHtml = '<div class="card">'+
      '<div class="mini-label mb-12">Nächstes Antreten</div>'+
      '<div style="display:flex;align-items:center;gap:14px">'+
        '<div style="text-align:center;flex:none;min-width:44px">'+
          '<div style="font-family:\'Fraunces\',serif;font-size:28px;font-weight:800;color:var(--green-deep);line-height:1">'+d.tag+'</div>'+
          '<div style="font-size:9px;text-transform:uppercase;color:var(--ink-soft);font-weight:700">'+escapeHtml(d.monat)+'</div>'+
        '</div>'+
        '<div>'+
          '<div style="font-weight:700;font-size:15px">'+escapeHtml(nt.titel)+'</div>'+
          '<div style="font-size:13px;color:var(--ink-soft)">'+(nt.zeit?nt.zeit+' Uhr':'')+(nt.ort?' · '+escapeHtml(nt.ort):'')+(nt.hinweis?' · '+escapeHtml(nt.hinweis):'')+'</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  } else {
    terminKarteHtml = '<div class="card">'+
      '<div class="mini-label mb-10">Nächstes Antreten</div>'+
      '<p class="leer">Keine kommenden Termine. Lege welche im Kalender an.</p>'+
    '</div>';
  }

  const ks = kassenstandBerechnen();
  const kassenstandKarteHtml =
    '<div class="db-mini-card" style="cursor:pointer;margin-bottom:14px;background:var(--gold-soft)" onclick="seiteAnzeigen(\'kasse\')">' +
    '<div class="db-mini-label">💶 Kassenstand</div>' +
    '<div class="db-mini-zahl" style="font-family:\'Fraunces\',serif;color:' + (ks >= 0 ? 'var(--green-deep)' : 'var(--bordeaux)') + '">' + euro(ks) + '</div>' +
    '</div>';

  ziel.innerHTML = kopfHtml + heroHtml + miniHtml + kassenstandKarteHtml + podiumKarteHtml + terminKarteHtml;
}

function podiumRender(ziel){
  if(!ziel) return;
  const top = rankingListe().filter(r=>r.gesamt>0).slice(0,3);
  if(top.length === 0){ ziel.innerHTML = '<p class="leer">Noch keine Strafen erfasst.</p>'; return; }
  ziel.innerHTML = top.map((r,i)=>{
    const ini = r.s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    return '<div class="podium-zeile-row'+(i===0?' platz1':'')+'">'+
      '<div class="pz-rang">'+(i+1)+'</div>'+
      '<div class="mini-avatar'+(i===0?' gold':'')+'">'+escapeHtml(ini)+'</div>'+
      '<div class="pz-name">'+escapeHtml(r.s.name)+(i===0?' 👑':'')+'</div>'+
      '<div class="pz-sum">'+euro(r.gesamt)+'</div>'+
    '</div>';
  }).join('');
}

function renderProfil(){
  const ziel = document.getElementById('profilInhalt');
  if(!aktuellerBenutzer){ ziel.innerHTML = '<p class="leer">Bitte einloggen, um dein Profil zu sehen.</p>'; return; }
  // meinMember hat die korrekte member.id, die mit schuetzeId in Strafen/Anwesenheiten übereinstimmt
  const meinMember = sbSession ? schuetzen.find(m => m.user_id === sbSession.user.id) : null;
  const s = meinMember || aktuellerBenutzer;
  const st = statsFuer(s);

  const bannerHtml = st.offen > 0
    ? '<div class="banner-offen">⚠️ Du hast noch <b>' + euro(st.offen) + '</b> offen</div>'
    : (st.anzahl > 0 ? '<div class="banner-ok">✓ Alles bezahlt</div>' : '');
  const initialen = s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const avatar = s.bild ? '<img class="sk-avatar" src="'+s.bild+'" alt="">' : '<div class="sk-avatar">'+escapeHtml(initialen)+'</div>';
  const badges = abzeichenFuer(s);

  let letzte = strafen.filter(x=>x.schuetzeId===s.id).slice(-5).reverse()
    .map(x=>'<div class="kal-row"><div class="kal-info"><b>'+escapeHtml(x.strafart)+'</b><span>'+x.datum+' · '+euro(x.betrag)+' · '+(x.bezahlt?'<span class="an">bezahlt</span>':'offen')+'</span></div></div>').join('');
  if(!letzte) letzte = '<p class="leer">Noch keine Strafen – weiter so!</p>';

  ziel.innerHTML = bannerHtml +
    '<div class="spielerkarte"><div class="sk-top">'+avatar+
      '<div><h3>'+escapeHtml(s.name)+'</h3><div class="mrolle">'+escapeHtml(s.rolle)+'</div>'+
      '<div class="rang">'+titelFuer(s)+'</div></div></div>'+
      '<div class="sk-stats">'+
        '<div class="sk-stat"><b>'+euro(st.gesamt)+'</b><span>Gesamt</span></div>'+
        '<div class="sk-stat"><b>'+euro(st.offen)+'</b><span>Offen</span></div>'+
        '<div class="sk-stat"><b>'+st.anzahl+'</b><span>Strafen</span></div>'+
        '<div class="sk-stat"><b>'+st.anwesend+'</b><span>Anwesend</span></div>'+
      '</div></div>'+
    '<div class="profil-actions">'+
      '<button class="btn-gold" onclick="profilEditOeffnen()">Profil bearbeiten</button>'+
      '<label class="btn-ghost mini-btn" style="cursor:pointer;display:inline-flex;align-items:center">Profilbild ändern<input type="file" accept="image/*" style="display:none" onchange="eigenesBildHochladen(this)"></label>'+
    '</div>'+
    '<h3>Deine Abzeichen</h3>'+
    '<div class="badges-grid">'+ badges.map(b=>'<div class="badge '+(b.hat?'on':'off')+'">'+b.e+
      '<span class="badge-name">'+b.name+'</span>'+
      '<span class="badge-tipp">'+escapeHtml(b.tipp)+'</span>'+
    '</div>').join('') +'</div>'+
    '<div id="customBadgesProfilBereich"></div>'+
    '<h3>Letzte Strafen</h3>'+ letzte;

  // Individuelle Abzeichen nachträglich füllen
  const bereich = document.getElementById('customBadgesProfilBereich');
  if(bereich){
    const vergeben = (s.awarded_custom_badges || []);
    const matchedTypes = customBadgeTypes.filter(b => vergeben.some(v => v.badge_id === b.id));
    if(matchedTypes.length){
      bereich.innerHTML = '<h3>Individuelle Abzeichen</h3>'+
        '<div class="badges-grid">'+
          matchedTypes.map(b=>'<div class="badge on">'+escapeHtml(b.emoji)+'<span class="badge-name">'+escapeHtml(b.name)+'</span></div>').join('')+
        '</div>';
    }
  }
}

function renderStrafen(){
  const filterSchuetze = document.getElementById('filterSchuetze')?.value || '';
  const filterStrafart = document.getElementById('filterStrafart')?.value || '';
  const filterVon      = document.getElementById('filterVon')?.value || '';
  const filterBis      = document.getElementById('filterBis')?.value || '';
  const suche          = (document.getElementById('strafenSuche')?.value || '').toLowerCase();

  // Formular nur für Offiziere zeigen
  const formBereich = document.getElementById('strafErfassenBereich');
  if(formBereich) formBereich.classList.toggle('hidden', !darfBearbeiten());

  const mehrfachBereich = document.getElementById('mehrfachErfassenBereich');
  if(mehrfachBereich){
    mehrfachBereich.classList.toggle('hidden', !darfBearbeiten());
    if(darfBearbeiten()){
      const aktive = schuetzen.filter(s => s.aktiv);
      document.getElementById('mehrfachMitgliederChips').innerHTML =
        aktive.map(s =>
          '<button type="button" class="filter-chip'+(mehrfachAusgewaehlt.has(s.id)?' aktiv':'')+
          '" data-id="'+s.id+'" onclick="mehrfachChipToggle(this)">'+escapeHtml(s.name)+'</button>'
        ).join('') || '<span class="muted">Keine aktiven Mitglieder</span>';
    }
  }

  // Status-Chips rendern
  const chipsEl = document.getElementById('strafenChips');
  if(chipsEl){
    chipsEl.innerHTML = [['alle','Alle'],['offen','Offen'],['bezahlt','Bezahlt']].map(([val,label])=>
      '<button class="filter-chip'+(strafenStatusFilter===val?' aktiv':'')+
      '" onclick="strafenStatusFilter=\''+val+'\';renderStrafen()">'+label+'</button>'
    ).join('');
  }

  const liste = strafen.slice().reverse().filter(x => {
    if(strafenStatusFilter==='offen'   &&  x.bezahlt) return false;
    if(strafenStatusFilter==='bezahlt' && !x.bezahlt) return false;
    if(filterSchuetze && x.schuetzeId !== filterSchuetze) return false;
    if(filterStrafart && x.strafart !== filterStrafart) return false;
    if(filterVon && x.datum < filterVon) return false;
    if(filterBis && x.datum > filterBis) return false;
    if(suche && !(x.schuetze+' '+x.strafart+' '+(x.kommentar||'')).toLowerCase().includes(suche)) return false;
    return true;
  });

  const hatFilter = strafenStatusFilter!=='alle' || filterSchuetze || filterStrafart || filterVon || filterBis || suche;
  const gefiltSum = liste.reduce((a,x) => a + x.betrag, 0);
  document.getElementById('gesamtbetrag').textContent = (hatFilter ? 'Gefiltert: ' : 'Gesamtsumme: ') + euro(gefiltSum);
  const darf = darfBearbeiten();
  document.getElementById('kassenberichtBereich')?.classList.toggle('hidden', !darf);

  const ziel = document.getElementById('strafenListe');
  if(!ziel) return;
  if(!liste.length){ ziel.innerHTML = '<div class="leer-zeile">Keine Einträge.</div>'; return; }

  ziel.innerHTML = liste.map(x=>{
    const initialen = (x.schuetze||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const aktionen = darf
      ? '<div class="sz-aktionen">'+
          '<button class="mini-btn" onclick="strafeBezahltToggle(\''+x.id+'\')" title="'+(x.bezahlt?'Als offen markieren':'Als bezahlt markieren')+'">'+(x.bezahlt?'↩︎':'✓')+'</button>'+
          '<button class="mini-btn delete-button" onclick="strafeLoeschen(\''+x.id+'\')" title="Löschen">🗑</button>'+
        '</div>'
      : '';
    return '<div class="strafen-list-zeile">'+
      '<div class="mini-avatar">'+escapeHtml(initialen)+'</div>'+
      '<div class="sz-mitte">'+
        '<span class="sz-name">'+escapeHtml(x.schuetze)+'</span>'+
        '<span class="sz-info">'+escapeHtml(x.strafart)+' · '+x.datum+(x.kommentar?' · '+escapeHtml(x.kommentar):'')+'</span>'+
      '</div>'+
      '<div class="sz-rechts">'+
        '<span class="sz-betrag">'+euro(x.betrag)+'</span>'+
        '<span class="'+(x.bezahlt?'status-bezahlt':'status-offen')+'">'+(x.bezahlt?'Bezahlt':'Offen')+'</span>'+
        (x.bezahlt&&x.bezahltArt?'<span style="font-size:11px;color:var(--ink-soft)">'+escapeHtml(x.bezahltArt)+'</span>':'')+
      '</div>'+
      aktionen+
    '</div>';
  }).join('');
}

function resetStrafenFilter(){
  strafenStatusFilter = 'alle';
  ['filterSchuetze','filterStrafart','filterVon','filterBis','strafenSuche'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  renderStrafen();
}

function renderKalender(){
  document.getElementById('kalenderFormBereich').classList.toggle('hidden', !darfBearbeiten());
  const nt = naechsterTermin();
  const nbox = document.getElementById('kalenderNaechster');
  if(nt){
    const d = datumKurz(nt.datum);
    nbox.innerHTML = '<div class="kal-next"><div class="t">Nächstes Antreten</div><div class="ev">'+escapeHtml(nt.titel)+'</div>'+
      '<div class="zeit">'+d.lang+(nt.zeit?' · '+nt.zeit+' Uhr':'')+(nt.ort?' · '+escapeHtml(nt.ort):'')+(nt.hinweis?' · '+escapeHtml(nt.hinweis):'')+'</div></div>';
  } else { nbox.innerHTML = ''; }

  const darf = darfBearbeiten();
  const sortiert = termine.slice().sort((a,b)=> (a.datum+a.zeit).localeCompare(b.datum+b.zeit));
  document.getElementById('kalenderListe').innerHTML = sortiert.map(t=>{
    const d = datumKurz(t.datum);
    return '<div class="kal-row"><div class="kal-date"><div class="d">'+d.tag+'</div><div class="m">'+d.monat+'</div></div>'+
      '<div class="kal-info"><b>'+escapeHtml(t.titel)+(t.antreten?' <span class="kal-badge">Antreten</span>':'')+'</b>'+
      '<span>'+(t.zeit?'<span class="an">'+t.zeit+' Uhr</span>':'')+(t.ort?' · '+escapeHtml(t.ort):'')+(t.hinweis?' · '+escapeHtml(t.hinweis):'')+'</span></div>'+
      (darf?'<button class="mini-btn delete-button" onclick="terminLoeschen(\''+t.id+'\')">🗑</button>':'')+'</div>';
  }).join('') || '<p class="leer">Noch keine Termine angelegt.</p>';
}

function renderRanking(){
  podiumRender(document.getElementById('rankingPodium'));

  const rang = rankingListe();
  const zugsauListe = document.getElementById('zugsauListe');
  if(zugsauListe){
    zugsauListe.innerHTML = rang.length===0
      ? '<div class="leer-zeile">Keine Daten.</div>'
      : rang.map((r,i)=>{
          const ini = r.s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
          return '<div class="strafen-list-zeile">'+
            '<div class="pz-rang">'+(i+1)+'</div>'+
            '<div class="mini-avatar'+(i===0?' gold':'')+'">'+escapeHtml(ini)+'</div>'+
            '<div class="sz-mitte"><span class="sz-name">'+escapeHtml(r.s.name)+'</span></div>'+
            '<div class="sz-betrag">'+euro(r.gesamt)+'</div>'+
          '</div>';
        }).join('');
  }

  const offene = rang.filter(r=>r.offen>0).sort((a,b)=>b.offen-a.offen);
  const schuldenListe = document.getElementById('schuldenListe');
  if(schuldenListe){
    schuldenListe.innerHTML = offene.length===0
      ? '<div class="leer-zeile">Alles bezahlt 🎉</div>'
      : offene.map(r=>{
          const ini = r.s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
          return '<div class="strafen-list-zeile">'+
            '<div class="mini-avatar">'+escapeHtml(ini)+'</div>'+
            '<div class="sz-mitte"><span class="sz-name">'+escapeHtml(r.s.name)+'</span></div>'+
            '<div class="sz-rechts">'+
              '<span class="sz-betrag" style="color:var(--bordeaux)">'+euro(r.offen)+'</span>'+
              '<span class="status-offen">Offen</span>'+
            '</div>'+
          '</div>';
        }).join('');
  }

  // Strafarten-Ranking Dropdown befüllen
  const srSel = document.getElementById('strafartRankingSelect');
  if(srSel){
    const prevVal = srSel.value;
    srSel.innerHTML = strafarten.map(a =>
      '<option value="'+escapeHtml(a.bezeichnung)+'">'+escapeHtml(a.bezeichnung)+'</option>'
    ).join('');
    if(prevVal && strafarten.find(a => a.bezeichnung === prevVal)){
      srSel.value = prevVal;
    } else {
      const vorbel = strafarten.find(a => /sp[äa]t/i.test(a.bezeichnung));
      if(vorbel) srSel.value = vorbel.bezeichnung;
    }
    renderStrafartRanking();
  }
}

function renderStrafartRanking(){
  const sel = document.getElementById('strafartRankingSelect');
  const liste = document.getElementById('strafartRankingListe');
  if(!sel || !liste) return;
  const gewaehlte = sel.value;
  if(!gewaehlte){
    liste.innerHTML = '<div class="leer-zeile">Keine Strafart ausgewählt.</div>';
    return;
  }
  const gefiltert = strafen.filter(x => x.strafart === gewaehlte);
  const mitDaten = schuetzen.filter(s => s.aktiv).reduce((acc, s) => {
    const eigen = gefiltert.filter(x => x.schuetzeId === s.id);
    if(eigen.length) acc.push({ s, anzahl: eigen.length, summe: eigen.reduce((a,x)=>a+x.betrag,0) });
    return acc;
  }, []).sort((a,b) => b.anzahl - a.anzahl || b.summe - a.summe);
  if(!mitDaten.length){
    liste.innerHTML = '<div class="leer-zeile">Für diese Strafart gibt es noch keine Einträge.</div>';
    return;
  }
  liste.innerHTML = mitDaten.map((r,i) => {
    const ini = r.s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    return '<div class="strafen-list-zeile">'+
      '<div class="pz-rang">'+(i+1)+'</div>'+
      '<div class="mini-avatar'+(i===0?' gold':'')+'">'+escapeHtml(ini)+'</div>'+
      '<div class="sz-mitte"><span class="sz-name">'+escapeHtml(r.s.name)+'</span></div>'+
      '<div class="sz-rechts">'+
        '<span class="sz-betrag">'+r.anzahl+'×</span>'+
        '<span class="muted" style="font-size:12px">'+euro(r.summe)+'</span>'+
      '</div>'+
    '</div>';
  }).join('');
}

let chronikLimit = 50;

function renderChronik(){
  const el = document.getElementById('chronikListe');
  if(!el) return;
  const ereignisse = [];
  strafen.forEach(x => {
    const s = findSchuetze(x.schuetzeId);
    const name = s ? s.name : (x.schuetze || '?');
    const tsStr = x.created_at || (x.datum + 'T00:00:00');
    ereignisse.push({
      ts: new Date(tsStr),
      icon: '🐷',
      text: escapeHtml(name) + ' – ' + escapeHtml(x.strafart) + ' (' + euro(x.betrag) + ')',
      label: 'Strafe erfasst'
    });
    if(x.bezahlt && x.bezahltDatum){
      ereignisse.push({
        ts: new Date(x.bezahltDatum + 'T00:00:00'),
        icon: '✅',
        text: escapeHtml(name) + ' hat ' + euro(x.betrag) + ' bezahlt',
        label: 'Bezahlt'
      });
    }
  });
  ereignisse.sort((a,b) => b.ts - a.ts);
  if(!ereignisse.length){
    el.innerHTML = '<div class="leer-zeile">Noch keine Aktivitäten.</div>';
    return;
  }
  const zeige = ereignisse.slice(0, chronikLimit);
  const mehr = ereignisse.length > zeige.length;
  el.innerHTML = zeige.map(e => {
    const datumStr = isNaN(e.ts) ? '?' : e.ts.toLocaleDateString('de-DE',{day:'numeric',month:'short',year:'numeric'});
    return '<div class="strafen-list-zeile">'+
      '<div style="font-size:20px;min-width:28px;text-align:center">'+e.icon+'</div>'+
      '<div class="sz-mitte">'+
        '<span class="sz-name">'+e.text+'</span>'+
        '<span class="sz-info">'+e.label+'</span>'+
      '</div>'+
      '<div class="sz-rechts"><span class="muted" style="font-size:12px;white-space:nowrap">'+datumStr+'</span></div>'+
    '</div>';
  }).join('') + (mehr
    ? '<button class="btn-ghost" style="margin-top:8px;width:100%" onclick="chronikAlleAnzeigen()">Mehr anzeigen ('+ereignisse.length+' gesamt)</button>'
    : '');
}

function chronikAlleAnzeigen(){
  chronikLimit = Infinity;
  renderChronik();
}

function renderMitglieder(){
  const darf = darfBearbeiten();
  document.getElementById('mitgliedHinzufuegenBereich')?.classList.toggle('hidden', !darf);
  document.getElementById('schuetzenListe').innerHTML = schuetzen.map(s=>{
    const initialen = s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const avatar = s.bild ? '<img class="mini-avatar" src="'+s.bild+'" alt="">' : '<div class="mini-avatar">'+escapeHtml(initialen)+'</div>';
    let akt = '<button class="mini-btn btn-ghost" onclick="schuetzenakteOeffnen(\''+s.id+'\')">Akte</button>';
    if(darf){
      akt += ' <button class="mini-btn btn-ghost" onclick="abzeichenModalOeffnen(\''+s.id+'\')">🎖️</button>'+
        ' <label class="mini-btn btn-ghost" style="cursor:pointer;display:inline-flex;align-items:center" title="Bild ändern">📷<input type="file" accept="image/*" style="display:none" onchange="mitgliedBildHochladen(\''+s.id+'\',this)"></label>'+
        ' <button class="mini-btn btn-ghost" onclick="schuetzeAktivToggle(\''+s.id+'\')" title="'+(s.aktiv?'Deaktivieren':'Aktivieren')+'">'+(s.aktiv?'⏸':'▶')+'</button>'+
        ' <button class="mini-btn delete-button" onclick="schuetzeLoeschen(\''+s.id+'\')" title="Löschen">🗑</button>';
    }
    return '<li class="'+(s.aktiv?'':'inaktiv')+'">'+avatar+
      '<div><div class="mname">'+escapeHtml(s.name)+'</div>'+
      '<div class="mrolle">'+escapeHtml(s.rolle)+'</div></div>'+
      '<div class="aktionen">'+akt+'</div></li>';
  }).join('') || '<li class="leer" style="list-style:none;padding:18px;text-align:center">Noch keine Mitglieder angelegt.</li>';
}

function renderEinstellungen(){
  const darf = darfBearbeiten();
  ['einstellungZugname','einstellungLogo','einstellungBackup','einstellungSaison'].forEach(id => {
    document.getElementById(id)?.classList.toggle('hidden', !darf);
  });
}

function renderStrafarten(){
  const darf = darfBearbeiten();
  document.getElementById('strafartHinzufuegenForm')?.classList.toggle('hidden', !darf);
  document.getElementById('strafartenListe').innerHTML = strafarten.map(a=>
    '<li><div><b>'+escapeHtml(a.bezeichnung)+'</b></div><div class="aktionen">'+euro(a.betrag)+
    (darf?' <button class="mini-btn delete-button" onclick="strafartLoeschen(\''+a.id+'\')">🗑</button>':'')+'</div></li>'
  ).join('') || '<li class="leer">Noch keine Strafarten angelegt.</li>';
}

function renderAnwesenheit(){
  renderSchnellErfassung();
  const darf = darfBearbeiten();
  document.getElementById('anwesenheitenTabelle').innerHTML = anwesenheiten.slice().reverse().map(a=>{
    const klasse = {'Anwesend':'status-anwesend','Zu spät':'status-zuspaet','Entschuldigt':'status-entschuldigt','Fehlend':'status-fehlend'}[a.status]||'';
    return '<tr><td>'+escapeHtml(a.tag)+'</td><td>'+escapeHtml(a.schuetze)+'</td>'+
      '<td><span class="'+klasse+'">'+escapeHtml(a.status)+'</span></td><td>'+(a.minuten||0)+'</td>'+
      '<td>'+(a.kommentar ? '<span class="anw-kommentar">'+escapeHtml(a.kommentar)+'</span>' : '–')+'</td>'+
      '<td>'+(darf?'<button class="mini-btn delete-button" onclick="anwesenheitLoeschen(\''+a.id+'\')">🗑</button>':'–')+'</td></tr>';
  }).join('') || '<tr><td colspan="6" class="leer">Keine Einträge.</td></tr>';

  document.getElementById('statistikTabelle').innerHTML = schuetzen.filter(s=>s.aktiv).map(s=>{
    const anw = anwesenheiten.filter(x=>x.schuetzeId===s.id);
    const z = st => anw.filter(x=>x.status===st).length;
    return '<tr><td>'+escapeHtml(s.name)+'</td><td>'+z('Anwesend')+'</td><td>'+z('Zu spät')+'</td><td>'+z('Entschuldigt')+'</td><td>'+z('Fehlend')+'</td></tr>';
  }).join('') || '<tr><td colspan="5" class="leer">Keine Mitglieder.</td></tr>';
}

function renderSelects(){
  const aktive = schuetzen.filter(s=>s.aktiv);
  const opt = aktive.map(s=>'<option value="'+s.id+'">'+escapeHtml(s.name)+'</option>').join('');
  const ss = document.getElementById('schuetzeSelect'); if(ss) ss.innerHTML = opt;
  const as = document.getElementById('anwesenheitSchuetzeSelect'); if(as) as.innerHTML = '<option value="">Schütze auswählen</option>'+opt;
  const art = document.getElementById('strafartSelect');
  if(art) art.innerHTML = '<option value="">Strafart wählen (optional)</option>'+strafarten.map((a,i)=>'<option value="'+i+'">'+escapeHtml(a.bezeichnung)+' ('+euro(a.betrag)+')</option>').join('');
  const mart = document.getElementById('mehrfachStrafartSelect');
  if(mart) mart.innerHTML = '<option value="">Strafart wählen (optional)</option>'+strafarten.map((a,i)=>'<option value="'+i+'">'+escapeHtml(a.bezeichnung)+' ('+euro(a.betrag)+')</option>').join('');

  // Strafen-Filter-Dropdowns befüllen (aktuelle Auswahl erhalten)
  const fSchuetze = document.getElementById('filterSchuetze');
  if(fSchuetze){
    const cur = fSchuetze.value;
    fSchuetze.innerHTML = '<option value="">Alle Schützen</option>' +
      schuetzen.map(s => '<option value="'+s.id+'">'+escapeHtml(s.name)+'</option>').join('');
    fSchuetze.value = cur;
  }
  const fStrafart = document.getElementById('filterStrafart');
  if(fStrafart){
    const cur = fStrafart.value;
    const arten = [...new Set(strafen.map(x => x.strafart))].sort();
    fStrafart.innerHTML = '<option value="">Alle Strafarten</option>' +
      arten.map(a => '<option value="'+escapeHtml(a)+'">'+escapeHtml(a)+'</option>').join('');
    fStrafart.value = cur;
  }

  betragAktualisieren();
  mehrfachBetragAktualisieren();
}

/* ============================================================
   AKTEN
   ============================================================ */
function schuetzenakteOeffnen(id){
  const s = findSchuetze(id); if(!s) return;
  const st = statsFuer(s);
  const eigene = strafen.filter(x=>x.schuetzeId===s.id).slice().reverse();
  const anw = anwesenheiten.filter(x=>x.schuetzeId===s.id);
  let strafenHtml = eigene.map(x=>'<div class="kal-row"><div class="kal-info"><b>'+escapeHtml(x.strafart)+'</b><span>'+x.datum+' · '+euro(x.betrag)+' · '+(x.bezahlt?'<span class="an">bezahlt</span>':'offen')+(x.kommentar?' · '+escapeHtml(x.kommentar):'')+'</span></div></div>').join('') || '<p class="leer">Keine Strafen.</p>';
  document.getElementById('schuetzenakteInhalt').innerHTML =
    '<div class="spielerkarte"><div class="sk-top"><div class="sk-avatar">'+escapeHtml(s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase())+'</div>'+
    '<div><h3>'+escapeHtml(s.name)+'</h3><div class="mrolle">'+escapeHtml(s.rolle)+'</div><div class="rang">'+titelFuer(s)+'</div></div></div>'+
    '<div class="sk-stats"><div class="sk-stat"><b>'+euro(st.gesamt)+'</b><span>Gesamt</span></div><div class="sk-stat"><b>'+euro(st.offen)+'</b><span>Offen</span></div>'+
    '<div class="sk-stat"><b>'+st.anzahl+'</b><span>Strafen</span></div><div class="sk-stat"><b>'+st.anwesend+'</b><span>Anwesend</span></div></div></div>'+
    '<h3>Strafen</h3>'+strafenHtml;
  seiteAnzeigen('akten');
}

/* ============================================================
   EINSTELLUNGEN
   ============================================================ */
async function zugnameSpeichern(){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const name = document.getElementById('zugnameInput').value.trim();
  if(!name){ showToast('Bitte einen Namen eingeben','error'); return; }
  const { error } = await sb.from('clubs').update({ name }).eq('id', sbClubId);
  if(error){ console.error('zugnameSpeichern:', error); showToast('Fehler: ' + error.message, 'error'); return; }
  zugname = name;
  sbClubName = name;
  showToast('Zugname gespeichert');
  await clubDatenLaden();
}
function logoSpeichern(){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const f = document.getElementById('logoInput').files[0];
  if(!f){ showToast('Bitte ein Bild wählen','error'); return; }
  const r = new FileReader();
  r.onload = async e => {
    logo = e.target.result;
    const { error } = await sb.from('clubs').update({ logo }).eq('id', sbClubId);
    if(error){ showToast('Fehler beim Speichern: ' + error.message, 'error'); return; }
    showToast('Logo gespeichert');
    appAktualisieren();
  };
  r.readAsDataURL(f);
}

/* ============================================================
   BACKUP / EXPORT / IMPORT
   ============================================================ */
function alleDaten(){ return { schuetzen, strafarten, strafen, anwesenheiten, termine, saisons, zugname, logo, stand:new Date().toISOString() }; }
function downloadDatei(inhalt, name, typ){
  const blob = new Blob([inhalt], {type:typ});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}
function exportDataAsJSON(){ downloadDatei(JSON.stringify(alleDaten(),null,2), 'strafenkatalog-backup.json', 'application/json'); showToast('Backup erstellt'); }
function autoBackup(){ exportDataAsJSON(); }
function exportDataAsCSV(){
  const kopf = ['Datum','Schütze','Strafart','Betrag','Kommentar','Status','Zahlungsart','Bezahlt am'];
  const zeilen = strafen.map(x=>[x.datum,x.schuetze,x.strafart,String(x.betrag).replace('.',','),(x.kommentar||''),x.bezahlt?'Bezahlt':'Offen',(x.bezahltArt||''),(x.bezahltDatum||'')]
    .map(f=>'"'+String(f).replace(/"/g,'""')+'"').join(';'));
  downloadDatei('\uFEFF'+[kopf.join(';'),...zeilen].join('\n'), 'strafen.csv', 'text/csv');
  showToast('CSV exportiert');
}
function importDataFromJSON(){
  const f = document.getElementById('importInput').files[0];
  if(!f){ showToast('Bitte eine JSON-Datei wählen','error'); return; }
  if(!confirm('Backup einspielen? Vorhandene Daten werden ersetzt.')) return;
  const r = new FileReader();
  r.onload = e => {
    try{
      const d = JSON.parse(e.target.result);
      schuetzen = d.schuetzen||[]; strafarten = d.strafarten||[]; strafen = d.strafen||[];
      anwesenheiten = d.anwesenheiten||[]; termine = d.termine||[]; saisons = d.saisons||[];
      zugname = d.zugname||zugname; logo = d.logo||'';
      aktuellerBenutzer = null;
      speichern(); showToast('Backup eingespielt'); appAktualisieren(); seiteAnzeigen('dashboard');
    }catch(err){ showToast('Datei konnte nicht gelesen werden','error'); }
  };
  r.readAsText(f);
}

/* ============================================================
   SAISON-ABSCHLUSS (Archiv)
   Schließt die laufende Saison ab: Strafen & Anwesenheiten werden
   als Schnappschuss archiviert und danach geleert. Mitglieder,
   Strafarten und Termine bleiben erhalten.
   ============================================================ */
async function saisonAbschliessen(){
  if(!darfBearbeiten()){ showToast('Nur Offiziere dürfen die Saison abschließen','error'); return; }
  if(strafen.length === 0 && anwesenheiten.length === 0){ showToast('Es gibt nichts zum Abschließen','info'); return; }
  const vorschlag = 'Saison ' + new Date().getFullYear();
  const name = prompt('Name der Saison (zum Archivieren):', vorschlag);
  if(name === null) return;
  if(!confirm('Saison „'+name+'" abschließen?\n\nAlle aktuellen Strafen und Anwesenheiten werden archiviert und danach geleert. Mitglieder und Strafarten bleiben.')) return;

  const gesamt = strafen.reduce((a,x)=>a+x.betrag,0);
  const bezahlt = strafen.filter(x=>x.bezahlt).reduce((a,x)=>a+x.betrag,0);
  const sau = rankingListe().filter(r=>r.gesamt>0)[0];
  const saisonName = name.trim() || vorschlag;

  const daten = {
    strafen: JSON.parse(JSON.stringify(strafen)),
    anwesenheiten: JSON.parse(JSON.stringify(anwesenheiten)),
    summary: {
      gesamt, bezahlt, offen: gesamt-bezahlt,
      anzahlStrafen: strafen.length,
      anzahlAnwesenheiten: anwesenheiten.filter(a=>a.status==='Anwesend').length,
      zugsau: sau ? { name: sau.s.name, sum: sau.gesamt } : null
    }
  };

  const { error: insertErr } = await sb.from('saisons').insert({
    club_id: sbClubId,
    name: saisonName,
    abgeschlossen_am: new Date().toISOString().slice(0,10),
    daten
  });
  if(insertErr){ console.error('saisonAbschliessen insert:', insertErr); showToast('Archivieren fehlgeschlagen: ' + insertErr.message, 'error'); return; }

  const { error: delSErr } = await sb.from('strafen').delete().eq('club_id', sbClubId);
  if(delSErr){ console.error('saisonAbschliessen delete strafen:', delSErr); showToast('Archiv gespeichert, aber Strafen konnten nicht geleert werden: ' + delSErr.message, 'error'); return; }
  const { error: delAErr } = await sb.from('anwesenheiten').delete().eq('club_id', sbClubId);
  if(delAErr){ console.error('saisonAbschliessen delete anwesenheiten:', delAErr); showToast('Archiv gespeichert, aber Anwesenheiten konnten nicht geleert werden: ' + delAErr.message, 'error'); return; }

  showToast('Saison „'+saisonName+'" archiviert – neue Saison gestartet 🎉');
  await clubDatenLaden();
  seiteAnzeigen('dashboard');
}

async function saisonLoeschen(id){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const s = saisons.find(x=>x.id===id); if(!s) return;
  if(!confirm('Archiv „'+s.name+'" endgültig löschen?')) return;
  const { error } = await sb.from('saisons').delete().eq('id', id);
  if(error){ console.error('saisonLoeschen:', error); showToast('Fehler: ' + error.message, 'error'); return; }
  showToast('Archiv gelöscht','warning');
  await clubDatenLaden();
}

function saisonDetails(id){
  const s = saisons.find(x=>x.id===id); if(!s) return;
  const summe = {};
  (s.daten.strafen || []).forEach(x=>{ summe[x.schuetze] = (summe[x.schuetze]||0) + x.betrag; });
  const rang = Object.entries(summe).sort((a,b)=>b[1]-a[1]);
  let zeilen = rang.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+escapeHtml(r[0])+'</td><td>'+euro(r[1])+'</td></tr>').join('') || '<tr><td colspan="3" class="leer">Keine Strafen.</td></tr>';
  const sm = s.daten.summary || {};
  document.getElementById('saisonModalTitel').textContent = s.name;
  document.getElementById('saisonModalInhalt').innerHTML =
    '<p class="muted">Abgeschlossen am '+s.abgeschlossen_am+'</p>'+
    '<div class="sk-stats" style="margin:12px 0">'+
      '<div class="sk-stat" style="background:var(--creme);border-color:var(--linie)"><b style="color:var(--gruen-900)">'+euro(sm.gesamt||0)+'</b><span style="color:var(--grau)">Gesamt</span></div>'+
      '<div class="sk-stat" style="background:var(--creme);border-color:var(--linie)"><b style="color:var(--gruen-900)">'+euro(sm.offen||0)+'</b><span style="color:var(--grau)">Offen</span></div>'+
      '<div class="sk-stat" style="background:var(--creme);border-color:var(--linie)"><b style="color:var(--gruen-900)">'+(sm.anzahlStrafen||0)+'</b><span style="color:var(--grau)">Strafen</span></div>'+
    '</div>'+
    '<div class="tabelle-scroll"><table><thead><tr><th>Platz</th><th>Schütze</th><th>Strafsumme</th></tr></thead><tbody>'+zeilen+'</tbody></table></div>';
  document.getElementById('saisonModal').classList.remove('hidden');
}
function closeSaisonModal(){ document.getElementById('saisonModal').classList.add('hidden'); }

function renderSaisons(){
  const ziel = document.getElementById('saisonListe');
  if(!ziel) return;
  if(saisons.length === 0){ ziel.innerHTML = '<p class="leer">Noch keine abgeschlossenen Saisons.</p>'; return; }
  const darf = darfBearbeiten();
  ziel.innerHTML = saisons.slice().reverse().map(s=>{
    const sm = (s.daten && s.daten.summary) || {};
    return '<div class="kal-row"><div class="kal-info"><b>'+escapeHtml(s.name)+'</b>'+
    '<span>'+s.abgeschlossen_am+' · '+euro(sm.gesamt||0)+' · '+(sm.anzahlStrafen||0)+' Strafen'+
    (sm.zugsau?' · 🐷 '+escapeHtml(sm.zugsau.name):'')+'</span></div>'+
    '<button class="mini-btn" onclick="saisonDetails(\''+s.id+'\')">Details</button>'+
    (darf?' <button class="mini-btn" onclick="saisonPdf(\''+s.id+'\')">📄 PDF</button>':'') +
    (darf?' <button class="mini-btn delete-button" onclick="saisonLoeschen(\''+s.id+'\')">🗑</button>':'')+'</div>';
  }).join('');
}

function renderCustomBadgeSettings(){
  const ziel = document.getElementById('customBadgeListe');
  if(!ziel) return;
  const darf = darfBearbeiten();
  const bereich = document.getElementById('customBadgeErstellen');
  if(bereich) bereich.classList.toggle('hidden', !darf);

  const individuelleTypes = customBadgeTypes.filter(b => !b.type);
  if(!individuelleTypes.length){
    ziel.innerHTML = '<li class="leer">Noch keine individuellen Abzeichen angelegt.</li>';
  } else {
    ziel.innerHTML = individuelleTypes.map(b =>
      '<li><div><b>'+escapeHtml(b.emoji)+' '+escapeHtml(b.name)+'</b></div>'+
      '<div class="aktionen">'+(darf ? '<button class="mini-btn delete-button" onclick="customBadgeLoeschen(\''+b.id+'\')">🗑</button>' : '')+'</div></li>'
    ).join('');
  }

  // Auto-Abzeichen verwalten (nur Offiziere)
  const autoBereich = document.getElementById('autoBadgeVerwaltung');
  if(autoBereich){
    if(darf){
      autoBereich.classList.remove('hidden');
      const deaktiviert = customBadgeTypes.filter(b => b.type === 'disabled_auto').map(b => b.id);
      autoBereich.innerHTML = '<h3>Auto-Abzeichen verwalten</h3>'+
        '<p class="muted" style="margin-bottom:10px">Abzeichen, die dein Zug nicht anzeigen möchte, hier deaktivieren.</p>'+
        ABZEICHEN.map(b => {
          const aktiv = !deaktiviert.includes(b.id);
          return '<div class="badge-modal-row" style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--linie)">'+
            '<span>'+b.e+' <b>'+escapeHtml(b.name)+'</b></span>'+
            '<button class="mini-btn '+(aktiv?'btn-gold':'')+'" onclick="autoAbzeichenToggle(\''+b.id+'\')">'+
            (aktiv ? 'Aktiv' : 'Deaktiviert')+'</button></div>';
        }).join('');
    } else {
      autoBereich.classList.add('hidden');
    }
  }
}

function renderHilfe(){
  const ziel = document.getElementById('hilfeInhalt');
  if(!ziel) return;
  const istOff = istOffizier(aktuellerBenutzer);

  function hilfeItem(icon, titel, text){
    return '<div class="hilfe-item">'+
      '<div class="hilfe-item-icon">'+icon+'</div>'+
      '<div><h4>'+escapeHtml(titel)+'</h4><p>'+escapeHtml(text)+'</p></div>'+
    '</div>';
  }

  if(istOff){
    ziel.innerHTML =
      '<div class="hilfe-bereich">'+
      '<h3>👮 Deine Seiten im Überblick</h3>'+
      '<div class="hilfe-grid">'+
      hilfeItem('🏠','Start','Überblick über offene Strafen des Zuges, Kassenstand, Zugsau-Ranking und das nächste Antreten.')+
      hilfeItem('💰','Strafen','Strafen einzeln oder für mehrere Schützen gleichzeitig erfassen, als bezahlt markieren, filtern und offene Beträge teilen.')+
      hilfeItem('✅','Anwesenheit','Schnell-Erfassung für alle auf einmal oder Einzel-Erfassung; „Zu spät" erzeugt automatisch eine Strafe gemäß Strafenkatalog.')+
      hilfeItem('📅','Kalender','Termine und Antrittszeiten anlegen.')+
      hilfeItem('🏆','Ranking','Zugsau-Ranking nach Gesamtbetrag und Ranking pro Strafart.')+
      hilfeItem('📜','Chronik','Vollständiger Verlauf aller Strafen und Zahlungen im Zug.')+
      hilfeItem('📊','Abstimmungen','Umfragen mit Einzel- oder Mehrfachauswahl erstellen, Ergebnisse live verfolgen und Abstimmungen schließen.')+
      hilfeItem('💶','Kasse','Einnahmen und Ausgaben buchen, Kassenstand im Blick behalten und bezahlte Strafen direkt als Einnahme übernehmen.')+
      hilfeItem('👥','Mitglieder','Mitglieder anlegen, Rollen vergeben, Profilbilder setzen und individuelle Abzeichen verleihen.')+
      hilfeItem('⚙️','Einstellungen','Strafarten mit Beträgen pflegen (Strafenkatalog), Zugname und Logo anpassen, Einladungscode anzeigen, Saison abschließen und Abzeichen verwalten.')+
      hilfeItem('👤','Profil','Eigene Spielerkarte mit Statistik, Abzeichen und den letzten Strafen.')+
      '</div>'+
      '<div class="unterkarte" style="margin-top:16px">'+
      '<h3 style="margin-top:0">🔑 Einladungscode</h3>'+
      '<p>Den Code findest du in den Einstellungen und in der Sidebar. Gib ihn an neue Mitglieder weiter, damit sie dem Zug beitreten können.</p>'+
      '<h3>💸 Offiziere zahlen doppelt</h3>'+
      '<p>Strafen für Offiziere werden automatisch mit dem doppelten Betrag berechnet – faire Führung heißt höhere Verantwortung.</p>'+
      '</div>'+
      '</div>';
  } else {
    ziel.innerHTML =
      '<div class="hilfe-bereich">'+
      '<h3>👁️ Deine Ansichten</h3>'+
      '<div class="hilfe-grid">'+
      hilfeItem('🏠','Start','Überblick über deine eigenen offenen Strafen und das nächste Antreten.')+
      hilfeItem('💰','Strafen','Alle Strafen im Zug einsehen – deine eigenen im Detail, inklusive Zahlungsstatus.')+
      hilfeItem('⚙️','Strafenkatalog','Unter Einstellungen nachschauen, welche Strafe wie viel kostet.')+
      hilfeItem('✅','Anwesenheit','Deine eigene Anwesenheitshistorie einsehen.')+
      hilfeItem('📅','Kalender','Termine und Antrittszeiten des Zuges ansehen.')+
      hilfeItem('🏆','Ranking','Sehen, wo du im Zugsau-Ranking stehst – und wer gerade Spitzenreiter ist.')+
      hilfeItem('📜','Chronik','Den Verlauf aller Aktivitäten im Zug verfolgen.')+
      hilfeItem('📊','Abstimmungen','An Umfragen des Zuges teilnehmen und Ergebnisse einsehen.')+
      hilfeItem('👤','Profil','Deine Spielerkarte mit Statistik, Abzeichen und deinen letzten Strafen.')+
      '</div>'+
      '<div class="unterkarte" style="margin-top:16px">'+
      '<h3 style="margin-top:0">🎖️ Automatische Abzeichen</h3>'+
      '<p style="font-size:13px;color:var(--ink-soft);margin-bottom:10px">Diese Abzeichen werden automatisch vergeben, sobald du die Kriterien erfüllst:</p>'+
      '<div class="hilfe-grid">'+
      ABZEICHEN.map(b =>
        '<div class="hilfe-item">'+
        '<div class="hilfe-item-icon">'+b.e+'</div>'+
        '<div><h4>'+escapeHtml(b.name)+'</h4><p>'+escapeHtml(b.tipp)+'</p></div>'+
        '</div>'
      ).join('')+
      '</div>'+
      '</div>'+
      '</div>';
  }
}

/* ============================================================
   ABSTIMMUNGEN / UMFRAGEN
   ============================================================ */
function renderAbstimmungen(){
  const formBereich = document.getElementById('umfrageFormBereich');
  const liste = document.getElementById('abstimmungenListe');
  if(!liste) return;

  if(formBereich){
    formBereich.classList.toggle('hidden', !darfBearbeiten());
  }

  const myUserId = sbSession?.user?.id;
  const sorted = umfragen.slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  if(!sorted.length){
    liste.innerHTML = '<p class="leer">Noch keine Abstimmungen vorhanden.</p>';
    return;
  }

  liste.innerHTML = sorted.map(u => {
    const optionen = umfrageOptionen
      .filter(o => o.umfrage_id === u.id)
      .sort((a,b) => a.sortierung - b.sortierung);
    const alleStimmen  = umfrageStimmen.filter(s => s.umfrage_id === u.id);
    const meineStimmen = alleStimmen.filter(s => s.user_id === myUserId);
    const istOffen     = !u.geschlossen;

    // Eindeutige Abstimmende (für Prozentbasis bei Mehrfachauswahl)
    const voterCount = new Set(alleStimmen.map(s => s.user_id)).size;
    const basis = voterCount || 1;

    const ergebnisHtml = optionen.map(o => {
      const n = alleStimmen.filter(s => s.option_id === o.id).length;
      const pct = Math.round(n / basis * 100);
      const meineWahl = meineStimmen.some(s => s.option_id === o.id);
      return '<div class="umfrage-ergebnis-zeile">' +
        '<div class="umfrage-option-label">' + (meineWahl ? '✓ ' : '') + escapeHtml(o.text) + '</div>' +
        '<div class="umfrage-balken-wrap"><div class="umfrage-balken" style="width:' + pct + '%"></div></div>' +
        '<div class="umfrage-stimmen-zahl">' + n + ' (' + pct + '%)</div>' +
        '</div>';
    }).join('');

    // Abstimmformular (nur wenn offen)
    let abstimmHtml = '';
    if(istOffen){
      const inputTyp = u.mehrfachauswahl ? 'checkbox' : 'radio';
      const controls = optionen.map((o, i) => {
        const checked = meineStimmen.some(s => s.option_id === o.id) ? ' checked' : '';
        return '<label class="umfrage-option-check">' +
          '<input type="' + inputTyp + '" name="umfrage_' + u.id + '" value="' + escapeHtml(o.id) + '"' + checked + '>' +
          escapeHtml(o.text) + '</label>';
      }).join('');
      abstimmHtml =
        '<div class="umfrage-optionen">' + controls + '</div>' +
        '<button class="btn-gold" style="margin-top:10px;width:auto" onclick="umfrageAbstimmen(\'' + u.id + '\')">Abstimmen</button>';
    }

    // Status-Tag + Offizier-Aktionen
    const geschlTag = !istOffen ? '<span class="umfrage-tag umfrage-tag-grau">Geschlossen</span>' : '';
    const mehrTag   = u.mehrfachauswahl ? '<span class="umfrage-tag">Mehrfachauswahl</span>' : '';
    let aktionenHtml = '';
    if(darfBearbeiten()){
      aktionenHtml = '<div class="btn-row" style="margin-top:12px">' +
        (istOffen
          ? '<button class="btn-ghost" style="width:auto" onclick="umfrageSchliessen(\'' + u.id + '\')">🔒 Schließen</button>'
          : '') +
        '<button class="delete-button" style="width:auto" onclick="umfrageLoeschen(\'' + u.id + '\')">Löschen</button>' +
        '</div>';
    }

    const gesamtLabel = '<p class="muted" style="margin-top:10px">' +
      voterCount + ' Abstimmende · ' + alleStimmen.length + ' Stimme' + (alleStimmen.length !== 1 ? 'n' : '') +
      '</p>';

    return '<div class="unterkarte umfrage-card">' +
      '<h4>' + escapeHtml(u.frage) + ' ' + mehrTag + geschlTag + '</h4>' +
      abstimmHtml +
      '<div class="umfrage-ergebnis' + (abstimmHtml ? ' umfrage-ergebnis-unten' : '') + '">' + ergebnisHtml + '</div>' +
      gesamtLabel +
      aktionenHtml +
      '</div>';
  }).join('');
}

function umfrageOptionHinzufuegen(){
  const container = document.getElementById('umfrageOptionenContainer');
  if(!container) return;
  const n = container.querySelectorAll('.umfrage-option-row').length + 1;
  const row = document.createElement('div');
  row.className = 'umfrage-option-row';
  row.innerHTML = '<input type="text" class="umfrage-option-input" placeholder="Option ' + n + '">' +
    '<button class="btn-ghost umfrage-option-entfernen" onclick="umfrageOptionEntfernen(this)">−</button>';
  container.appendChild(row);
}

function umfrageOptionEntfernen(btn){
  const container = document.getElementById('umfrageOptionenContainer');
  if(!container) return;
  const rows = container.querySelectorAll('.umfrage-option-row');
  if(rows.length <= 2){ showToast('Mindestens 2 Optionen erforderlich','error'); return; }
  btn.closest('.umfrage-option-row').remove();
}

async function umfrageErstellen(){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const frage = document.getElementById('umfrageFrage')?.value.trim();
  if(!frage){ showToast('Frage eingeben','error'); return; }
  const mehrfach = document.getElementById('umfrageMehrfach')?.checked || false;
  const optTexte = Array.from(document.querySelectorAll('.umfrage-option-input'))
    .map(f => f.value.trim()).filter(t => t);
  if(optTexte.length < 2){ showToast('Mindestens 2 Antwortoptionen eingeben','error'); return; }

  const { data: neu, error: e1 } = await sb.from('umfragen')
    .insert({ club_id: sbClubId, frage, mehrfachauswahl: mehrfach })
    .select().single();
  if(e1){ console.error(e1); showToast('Fehler: ' + e1.message,'error'); return; }

  const inserts = optTexte.map((text, i) => ({
    umfrage_id: neu.id, club_id: sbClubId, text, sortierung: i
  }));
  const { error: e2 } = await sb.from('umfrage_optionen').insert(inserts);
  if(e2){ console.error(e2); showToast('Fehler: ' + e2.message,'error'); return; }

  showToast('Abstimmung erstellt!');
  document.getElementById('umfrageFrage').value = '';
  document.getElementById('umfrageMehrfach').checked = false;
  const container = document.getElementById('umfrageOptionenContainer');
  if(container){
    container.innerHTML =
      '<div class="umfrage-option-row"><input type="text" class="umfrage-option-input" placeholder="Option 1"><button class="btn-ghost umfrage-option-entfernen" onclick="umfrageOptionEntfernen(this)">−</button></div>' +
      '<div class="umfrage-option-row"><input type="text" class="umfrage-option-input" placeholder="Option 2"><button class="btn-ghost umfrage-option-entfernen" onclick="umfrageOptionEntfernen(this)">−</button></div>';
  }
  await clubDatenLaden();
}

async function umfrageSchliessen(id){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const { error } = await sb.from('umfragen').update({ geschlossen: true }).eq('id', id);
  if(error){ console.error(error); showToast('Fehler: ' + error.message,'error'); return; }
  showToast('Abstimmung geschlossen','info');
  await clubDatenLaden();
}

async function umfrageLoeschen(id){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const { error } = await sb.from('umfragen').delete().eq('id', id);
  if(error){ console.error(error); showToast('Fehler: ' + error.message,'error'); return; }
  showToast('Abstimmung gelöscht','warning');
  await clubDatenLaden();
}

async function umfrageAbstimmen(umfrageId){
  const myUserId = sbSession?.user?.id;
  if(!myUserId){ showToast('Nicht angemeldet','error'); return; }
  const umfrage = umfragen.find(u => u.id === umfrageId);
  if(!umfrage || umfrage.geschlossen){ showToast('Abstimmung geschlossen','error'); return; }

  const inputs = document.querySelectorAll('input[name="umfrage_' + umfrageId + '"]:checked');
  const gewaehlte = Array.from(inputs).map(i => i.value);
  if(!gewaehlte.length){ showToast('Bitte mindestens eine Option wählen','error'); return; }

  // Bei Einfachauswahl: eigene alte Stimmen löschen (Wahl ändern möglich)
  if(!umfrage.mehrfachauswahl){
    const { error: delErr } = await sb.from('umfrage_stimmen')
      .delete().eq('umfrage_id', umfrageId).eq('user_id', myUserId);
    if(delErr){ console.error(delErr); showToast('Fehler: ' + delErr.message,'error'); return; }
  }

  const inserts = gewaehlte.map(optionId => ({
    umfrage_id: umfrageId, option_id: optionId, club_id: sbClubId, user_id: myUserId
  }));
  const { error } = await sb.from('umfrage_stimmen').insert(inserts);
  if(error){ console.error(error); showToast('Fehler: ' + error.message,'error'); return; }
  showToast('Stimme gespeichert ✓');
  await clubDatenLaden();
}

/* ============================================================
   KASSE (Einnahmen / Ausgaben / Kassenstand)
   ============================================================ */
function renderKasse(){
  const ziel = document.getElementById('kasseInhalt');
  if(!ziel) return;
  const ksEinnahmen = kassenbuchungen.filter(b => b.typ === 'einnahme').reduce((a, b) => a + b.betrag, 0);
  const ksAusgaben  = kassenbuchungen.filter(b => b.typ === 'ausgabe').reduce((a, b) => a + b.betrag, 0);
  const ksStand     = ksEinnahmen - ksAusgaben;
  const darf        = darfBearbeiten();

  const heroHtml =
    '<div class="db-hero" style="cursor:default;margin-bottom:14px">' +
    '<div class="db-hero-label">Kassenstand</div>' +
    '<div class="db-hero-zahl" style="color:' + (ksStand >= 0 ? '' : 'var(--bordeaux)') + '">' + euro(ksStand) + '</div>' +
    '<div style="display:flex;gap:20px;margin-top:8px;flex-wrap:wrap">' +
    '<span style="font-size:13px;color:var(--paid-tx)">▲ Einnahmen: ' + euro(ksEinnahmen) + '</span>' +
    '<span style="font-size:13px;color:var(--bordeaux)">▼ Ausgaben: ' + euro(ksAusgaben) + '</span>' +
    '</div></div>';

  let formHtml = '';
  if(darf){
    const heute = new Date().toISOString().slice(0,10);
    formHtml =
      '<div class="unterkarte">' +
      '<div class="mini-label mb-10">＋ Buchung erfassen</div>' +
      '<div class="form-grid">' +
      '<select id="kasseBuchungTyp"><option value="einnahme">Einnahme</option><option value="ausgabe">Ausgabe</option></select>' +
      '<input id="kasseBuchungBetrag" type="number" placeholder="Betrag in €" min="0" step="0.01">' +
      '<input id="kasseBuchungZweck" type="text" placeholder="Zweck (z. B. Bierkauf)">' +
      '<input id="kasseBuchungDatum" type="date" value="' + heute + '">' +
      '</div>' +
      '<div class="btn-row" style="margin-top:10px">' +
      '<button class="btn-gold" onclick="kassenbuchungHinzufuegen()">Buchung speichern</button>' +
      '<button class="btn-ghost" style="width:auto" onclick="bezahlteStrafenUebernehmen()">💰 Bezahlte Strafen übernehmen</button>' +
      '</div></div>';
  }

  const sorted = kassenbuchungen.slice().sort((a, b) => {
    const d = (b.datum || '').localeCompare(a.datum || '');
    if(d !== 0) return d;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  const listeHtml = !sorted.length
    ? '<div class="leer-zeile">Noch keine Buchungen vorhanden.</div>'
    : sorted.map(b => {
        const istEin = b.typ === 'einnahme';
        return '<div class="strafen-list-zeile">' +
          '<div style="font-size:18px;min-width:28px;text-align:center;color:' + (istEin ? 'var(--paid-tx)' : 'var(--bordeaux)') + '">' + (istEin ? '▲' : '▼') + '</div>' +
          '<div class="sz-mitte">' +
          '<span class="sz-name">' + escapeHtml(b.zweck || '–') + '</span>' +
          '<span class="sz-info">' + (b.datum || '') + '</span>' +
          '</div>' +
          '<div class="sz-rechts">' +
          '<span class="sz-betrag" style="color:' + (istEin ? 'var(--paid-tx)' : 'var(--bordeaux)') + '">' +
          (istEin ? '+' : '−') + euro(b.betrag) + '</span>' +
          '</div>' +
          (darf ? '<div class="sz-aktionen"><button class="mini-btn delete-button" onclick="kassenbuchungLoeschen(\'' + b.id + '\')" title="Löschen">🗑</button></div>' : '') +
          '</div>';
      }).join('');

  ziel.innerHTML = heroHtml + formHtml +
    '<h3>Buchungen</h3>' +
    '<div class="strafen-list">' + listeHtml + '</div>';
}

async function kassenbuchungHinzufuegen(){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const typ    = document.getElementById('kasseBuchungTyp').value;
  const betrag = parseFloat(document.getElementById('kasseBuchungBetrag').value);
  const zweck  = document.getElementById('kasseBuchungZweck').value.trim();
  const datum  = document.getElementById('kasseBuchungDatum').value || new Date().toISOString().slice(0,10);
  if(isNaN(betrag) || betrag <= 0){ showToast('Gültigen Betrag eingeben','error'); return; }
  if(!zweck){ showToast('Bitte Zweck eingeben','error'); return; }
  const { error } = await sb.from('kassenbuchungen').insert({ club_id: sbClubId, typ, betrag, zweck, datum });
  if(error){ console.error(error); showToast('Fehler: ' + error.message, 'error'); return; }
  document.getElementById('kasseBuchungBetrag').value = '';
  document.getElementById('kasseBuchungZweck').value = '';
  showToast((typ === 'einnahme' ? 'Einnahme' : 'Ausgabe') + ' gespeichert');
  await clubDatenLaden();
}

async function kassenbuchungLoeschen(id){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  if(!confirm('Buchung wirklich löschen?')) return;
  const { error } = await sb.from('kassenbuchungen').delete().eq('id', id);
  if(error){ console.error(error); showToast('Fehler: ' + error.message, 'error'); return; }
  showToast('Buchung gelöscht','warning');
  await clubDatenLaden();
}

async function bezahlteStrafenUebernehmen(){
  if(!darfBearbeiten()){ showToast('Keine Berechtigung','error'); return; }
  const summe = strafen.filter(x => x.bezahlt).reduce((a, x) => a + x.betrag, 0);
  if(summe <= 0){ showToast('Keine bezahlten Strafen vorhanden','info'); return; }
  const datum = new Date().toISOString().slice(0,10);
  const fmt = n => n.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
  if(!confirm('Bezahlte Strafen als Einnahme buchen?\n\nBetrag: ' + fmt(summe) + '\nZweck: „Strafen ' + datum + '"')) return;
  const zweck = 'Strafen ' + datum;
  const { error } = await sb.from('kassenbuchungen').insert({ club_id: sbClubId, typ: 'einnahme', betrag: summe, zweck, datum });
  if(error){ console.error(error); showToast('Fehler: ' + error.message, 'error'); return; }
  showToast('Einnahme von ' + fmt(summe) + ' gebucht');
  await clubDatenLaden();
}

/* ============================================================
   KASSENBERICHT ALS PDF
   ============================================================ */
function kassenberichtPdf(strafenListe, saisonTitel) {
  strafenListe = strafenListe || strafen;
  if (!strafenListe.length) { showToast('Keine Strafen vorhanden', 'info'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const heute = new Date().toLocaleDateString('de-DE');
  const heuteDateiname = new Date().toISOString().slice(0, 10);
  const zugnameSauber = (zugname || 'Zug').replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const kopftitel = saisonTitel ? 'Kassenbericht – ' + saisonTitel : 'Kassenbericht';

  // Logo oben rechts (base64 data URL)
  if (logo) {
    try { doc.addImage(logo, 165, 8, 25, 25); } catch (e) { /* weglassen */ }
  }

  // Kopfzeile
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(kopftitel, 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(zugname || 'Schützenzug', 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Erstellt am: ' + heute, 14, 32);
  doc.setTextColor(0, 0, 0);

  // Tabelle – sortiert nach Schütze, dann Datum
  const sortiert = strafenListe.slice().sort((a, b) =>
    (a.schuetze || '').localeCompare(b.schuetze || '', 'de') || (a.datum || '').localeCompare(b.datum || '')
  );

  doc.autoTable({
    head: [['Datum', 'Schütze', 'Strafart', 'Betrag', 'Bezahlt', 'Zahlungsart']],
    body: sortiert.map(x => [
      x.datum || '',
      x.schuetze || '',
      x.strafart || '',
      euro(x.betrag || 0),
      x.bezahlt ? 'Ja' : 'Nein',
      x.bezahltArt || '–'
    ]),
    startY: 38,
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [22, 59, 48], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 242, 235] },
    columnStyles: {
      0: { cellWidth: 22 },
      3: { halign: 'right', cellWidth: 24 },
      4: { cellWidth: 18 },
      5: { cellWidth: 28 }
    }
  });

  // Zusammenfassung unter der Tabelle
  const gesamt   = strafenListe.reduce((a, x) => a + (x.betrag || 0), 0);
  const bezahlt  = strafenListe.filter(x => x.bezahlt).reduce((a, x) => a + (x.betrag || 0), 0);
  const offen    = gesamt - bezahlt;
  const baseY    = doc.lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Zusammenfassung', 14, baseY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Gesamtsumme:   ' + euro(gesamt),  14, baseY + 6);
  doc.setTextColor(22, 100, 60);
  doc.text('Davon bezahlt: ' + euro(bezahlt), 14, baseY + 12);
  doc.setTextColor(160, 30, 30);
  doc.text('Davon offen:   ' + euro(offen),   14, baseY + 18);
  doc.setTextColor(0, 0, 0);

  doc.save('Kassenbericht-' + zugnameSauber + '-' + heuteDateiname + '.pdf');
}

function saisonPdf(id) {
  const s = saisons.find(x => x.id === id);
  if (!s) return;
  kassenberichtPdf(s.daten.strafen || [], s.name);
}

/* ============================================================
   PWA – Installierbarkeit
   ============================================================ */
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); installPrompt = e;
  if(document.getElementById('installHint')) return;
  const h = document.createElement('div');
  h.id = 'installHint'; h.className = 'install-hint';
  h.innerHTML = '📲 App installieren? <button class="btn-gold" onclick="appInstallieren()">Installieren</button><button class="schliess" onclick="this.parentElement.remove()">×</button>';
  document.body.appendChild(h);
});
function appInstallieren(){
  if(!installPrompt) return;
  installPrompt.prompt();
  installPrompt.userChoice.finally(()=>{ installPrompt=null; document.getElementById('installHint')?.remove(); });
}

/* ============================================================
   START
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // onAuthStateChange reagiert auch auf den Initialzustand (INITIAL_SESSION-Event)
  sb.auth.onAuthStateChange((_event, session) => {
    sbSession = session;
    checkAppState();
  });
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
});
