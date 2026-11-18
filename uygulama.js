// Animasal post prod sayfası — İSKELET (13.11.2026). Gerçek Supabase'te DENENMEDİ.
// Giriş: Google (Supabase Auth, pkce). Veri: musteri_giris / musteri_proje / musteri_istek / musteri_mesaj (security definer işlevler).
// Müşteri eski tablolara erişemez (uyeler'e bağlı değil). config.js: window.AP_AYAR = { url, anahtar } (yap.mjs .env.local'dan yazar).
/* global supabase */
const $ = (s) => document.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const DURUM = { sira: ['Sırada', 'd-sira'], cal: ['Çalışılıyor', 'd-cal'], gon: ['Gönderildi', 'd-gon'], rev: ['Revizede', 'd-rev'], ok: ['Onaylandı', 'd-ok'], eks: ['Eksik', 'd-eks'], ipt: ['İptal', 'd-ipt'] }
const sakla = (k, v) => { try { localStorage.setItem(k, v) } catch {} }
const al = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const tarih = (t) => (t ? new Date(t).toLocaleString('tr-TR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')

const sb = supabase.createClient(window.AP_AYAR.url, window.AP_AYAR.anahtar, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, storageKey: 'pp-oturum' } })
const d = { giris: null, proje: null, pid: al('pp-proje'), bolum: null, gorunum: 'plan', suzgec: null, ara: '', mpKapali: al('pp-mesaj-kapali') === '1', mpPlan: null, sonMesaj: 0, ses: al('pp-ses') !== '0', secili: new Set(), okAcik: false }

function tost(m) { const t = document.createElement('div'); t.className = 'tost'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3500) }
let ac = null
function ding() {
  if (!d.ses) return
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)()
    const t = ac.currentTime
    ;[[880, 0], [1320, 0.09]].forEach(([f, g0]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t + g0); g.gain.linearRampToValueAtTime(0.12, t + g0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + g0 + 0.22); o.connect(g).connect(ac.destination); o.start(t + g0); o.stop(t + g0 + 0.25) })
  } catch {}
}

// ---- giriş ----
async function basla() {
  const { data } = await sb.auth.getSession()
  if (!data.session) return girisEkrani()
  const g = await sb.rpc('musteri_giris')
  if (g.error) return girisEkrani('Giriş doğrulanamadı: ' + g.error.message)
  if (!g.data) return girisEkrani('Bu hesap Google hesabı değil ya da Animasal ekibine ait. Post prod Google hesabınızla girin.', true)
  d.giris = g.data
  if (!g.data.projeler.length) return girisEkrani(`${esc(g.data.eposta)} hiçbir projeye ekli değil. Animasal'a haber verildi; eklendiğinizde bu sayfadan girebilirsiniz.`, true)
  if (!g.data.projeler.some((p) => p.id === d.pid)) d.pid = g.data.projeler[0].id
  await yukle()
  setInterval(() => yukle({ arka: true }), 30e3)
  nabiz()
  setInterval(nabiz, 30e3)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') nabiz() })
}
// Animasal'ın Pipeline'ında "şu an sayfada" görünmek için (14.11): yalnızca sekme görünürken; hata sessiz (SQL çalıştırılmamış olabilir)
function nabiz() {
  if (document.visibilityState !== 'visible' || !d.pid) return
  sb.rpc('musteri_nabiz', { p_pid: d.pid, p_kim: al('pp-kim') || null }).then(() => {}, () => {})
}
function girisEkrani(hata = '', cikis = false) {
  $('#kok').innerHTML = `<div class="kart giris"><img src="logo.png" alt="Animasal"><h1>Animasal · Post prod</h1>
    <p class="gizli-not">Planlarınızı görmek, onay / revize vermek ve Animasal ile yazışmak için projeye eklenmiş Google hesabınızla girin.</p>
    ${hata ? `<div class="hata-kutu">${hata}</div>` : ''}
    <button class="btn ana" id="gGiris">Google ile giriş</button>${cikis ? '<button class="btn" id="cikis">Başka hesapla gir</button>' : ''}</div>`
  $('#gGiris').onclick = () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } })
  if (cikis) $('#cikis').onclick = async () => { await sb.auth.signOut(); girisEkrani() }
}

// ---- veri ----
async function yukle({ arka = false } = {}) {
  const r = await sb.rpc('musteri_proje', { p_pid: d.pid })
  if (r.error) return tost('Yüklenemedi: ' + r.error.message)
  const eski = d.proje
  d.proje = r.data
  // Pipeline bölümü "teslim edildi" deyince durum = teslim yazar (teslimEdildi alanı yazılmaz)
  for (const b of d.proje.bolumler || []) b.teslimEdildi = b.durum === 'teslim' || b.teslimEdildi === true || b.teslimEdildi === 'true'
  sakla('pp-proje', d.pid)
  const acik = (d.proje.bolumler || []).filter((b) => !b.teslimEdildi)
  if (d.bolum == null || !d.proje.bolumler.some((b) => b.no === d.bolum)) d.bolum = (acik[acik.length - 1] || d.proje.bolumler[d.proje.bolumler.length - 1] || {}).no ?? null
  const yeniAnimasal = (d.proje.mesajlar || []).filter((m) => m.taraf === 'animasal' && m.id > d.sonMesaj)
  if (eski && yeniAnimasal.length) { ding(); if (d.mpKapali) d.okunmamis = (d.okunmamis || 0) + yeniAnimasal.length }
  d.sonMesaj = Math.max(0, ...(d.proje.mesajlar || []).map((m) => m.id))
  // 30 sn'lik yenilemede açık bir seçim listesi (proje) kapanmasın: çizim bir sonraki yenilemeye kalır
  const a = document.activeElement
  if (arka && a && a.tagName === 'SELECT' && $('#kok').contains(a)) return
  ciz()
}

// ---- yeniden çizimde yazılanları koru (14.11) ----
// ciz() bütün sayfayı innerHTML ile yeniden kurar; yazılmakta olan mesaj, "Yazan" adı, link kutusu ve açık revize / eksik notları
// çizimden önce okunur, sonra değer + imleç (+ odak) geri konur.
const KORUNAN = ['mpMetin', 'mpKim', 'linkGir', 'ara']
function yazilariAl() {
  const s = { alan: {}, notlar: [], odak: null, mpAlt: true, mpUst: 0 }
  for (const id of KORUNAN) { const e = document.getElementById(id); if (e) s.alan[id] = { v: e.value, b: e.selectionStart, s: e.selectionEnd } }
  document.querySelectorAll('.notkutu[data-p]').forEach((k) => { const t = k.querySelector('textarea'); s.notlar.push({ p: k.dataset.p, k: k.dataset.k, v: t.value, b: t.selectionStart, s: t.selectionEnd }) })
  const a = document.activeElement
  if (a && KORUNAN.includes(a.id)) s.odak = a.id
  else if (a && a.closest && a.closest('.notkutu[data-p]')) s.odak = 'not:' + a.closest('.notkutu').dataset.p
  const g = $('#mpGovde'); if (g) { s.mpAlt = g.scrollHeight - g.scrollTop - g.clientHeight < 40; s.mpUst = g.scrollTop }
  return s
}
function yazilariKoy(s) {
  const imlec = (e, x) => { try { if (x.b != null) e.setSelectionRange(x.b, x.s ?? x.b) } catch {} }
  for (const [id, x] of Object.entries(s.alan)) {
    const e = document.getElementById(id)
    if (!e || id === 'ara') continue // arama d.ara'dan çizilir
    if (e.value !== x.v) e.value = x.v
  }
  for (const n of s.notlar) if ($('#not-' + n.p)) notKutusu(n.p, n.k, n.v, false)
  if (s.odak?.startsWith('not:')) { const t = document.querySelector(`.notkutu[data-p="${s.odak.slice(4)}"] textarea`); const n = s.notlar.find((x) => 'not:' + x.p === s.odak); if (t) { t.focus(); if (n) imlec(t, n) } }
  else if (s.odak) { const e = document.getElementById(s.odak); if (e) { e.focus(); imlec(e, s.alan[s.odak]) } }
  const g = $('#mpGovde'); if (g) g.scrollTop = s.mpAlt ? g.scrollHeight : s.mpUst
}
// Plan satırındaki revize / eksik not kutusu (açık kutu yeniden çizimde korunur)
function notKutusu(pid, k, metin = '', odakla = true) {
  const yer = $('#not-' + pid); if (!yer) return
  yer.innerHTML = `<div class="notkutu" data-p="${esc(pid)}" data-k="${esc(k)}"><textarea placeholder="${k === 'rev' ? 'Ne düzeltilecek?' : 'Ne eksik?'}"></textarea><div class="satir"><button class="btn">${k === 'rev' ? 'Revize gönder' : 'Eksik olarak bildir'}</button></div></div>`
  const t = yer.querySelector('textarea'); t.value = metin
  if (odakla) t.focus()
  yer.querySelector('button').onclick = async () => {
    const not = t.value.trim()
    yer.innerHTML = '' // gönderilirken kapanır; olmazsa yazıyla geri açılır
    if (await istek('karar', { karar: k, not }, pid)) tost(k === 'rev' ? 'Revize gönderildi' : 'Eksik bildirildi')
    else notKutusu(pid, k, not)
  }
}
// Post prod'un eklediği link Pipeline işleyene kadar listede "iletiliyor…" diye görünür (14.11)
d.yerelLinkler = [] // [{ link, tanitim, bolum, pid, zaman }]: gönderilen ama henüz istek listesinde görünmeyenler
function bekleyenLinkler(b, tanitim) {
  const P = d.proje, kayitli = new Set(((tanitim ? b.tanitimLinkleri : b.linkler) || []).map((l) => l.link))
  const l = []
  const gun = Date.now() - 864e5
  for (const i of P.istekler || []) {
    if (i.tur !== 'link' || i.bolum !== d.bolum || !!i.veri?.tanitim !== tanitim || kayitli.has(i.veri?.link)) continue
    if (i.durum === 'yeni' || i.durum === 'isleniyor') l.push({ link: i.veri?.link, zaman: i.zaman, durum: 'iletiliyor' })
    else if (i.durum === 'red' && Date.parse(i.zaman) > gun) l.push({ link: i.veri?.link, zaman: i.zaman, durum: 'red', not: i.cevap?.not })
  }
  d.yerelLinkler = d.yerelLinkler.filter((y) => y.pid === d.pid && !kayitli.has(y.link) && !(P.istekler || []).some((i) => i.tur === 'link' && i.veri?.link === y.link && i.durum !== 'yeni' && i.durum !== 'isleniyor'))
  for (const y of d.yerelLinkler) if (y.bolum === d.bolum && y.tanitim === tanitim && !l.some((x) => x.link === y.link)) l.push({ link: y.link, zaman: y.zaman, durum: 'iletiliyor' })
  return l
}
async function istek(tur, veri = {}, plan = null) {
  const r = await sb.rpc('musteri_istek', { p_pid: d.pid, p_bolum: d.bolum, p_plan: plan, p_tur: tur, p_veri: veri, p_kim: al('pp-kim') || null })
  if (r.error) { tost('Olmadı: ' + r.error.message); return null }
  await yukle()
  return r.data
}

// ---- çizim ----
const planlar = () => (d.proje?.planlar || []).filter((p) => p.bolum === d.bolum && !!p.tanitim === (d.gorunum === 'tanitim'))
// müşterinin bekleyen kararı (Pipeline işleyene kadar) planın görünen durumunu değiştirir
const bekleyenKarar = (pid) => (d.proje?.istekler || []).find((i) => i.tur === 'karar' && i.plan === pid && i.durum === 'yeni')
const gorunenDurum = (p) => { const k = bekleyenKarar(p.id); return k ? k.veri.karar : p.durum }
function sayac() {
  const c = { toplam: 0, gon: 0, ok: 0, rev: 0, eks: 0, kalan: 0 }
  for (const p of planlar()) { if (p.anaPlan) continue; const s = gorunenDurum(p); if (s === 'ipt') continue; c.toplam++; if (s in c) c[s]++; if (s === 'sira' || s === 'cal') c.kalan++ }
  return c
}
// Bildirim akışı (13.11, Aytaç: "Pipeline'daki panodan ~%50 büyük, özet akışı gibi"): Animasal'dan gelenler ve isteklerinizin durumu.
// Yalnızca okunur; yeniler kalın (bu tarayıcıda son görülen ana göre), panele tıklayınca görüldü sayılır.
const ISTEK_AD = { karar: 'kararınız', 'kalanlari-onayla': '"Kalanları onayla" isteğiniz', acil: 'acil isteğiniz', 'teslim-tarihi': 'teslim tarihi isteğiniz', link: 'linkiniz', 'ortak-cevap': 'cevabınız' }
function bildirimler() {
  const P = d.proje, l = []
  const planNo = (id) => String((P.planlar || []).find((p) => p.id === id)?.no || '').split(' ')[0]
  const bEt = (no) => (no != null && no !== d.bolum ? `B${no} · ` : '')
  for (const m of P.mesajlar || []) if (m.taraf === 'animasal') l.push({ z: m.zaman, r: '--gon', t: `${bEt(m.bolum)}Animasal mesaj yazdı${m.plan ? ` (${planNo(m.plan)})` : ''}: “${m.metin.slice(0, 140)}”`, msj: 1 })
  const teslim = new Map()
  for (const p of P.planlar || []) if (p.teslimLink) { const t = teslim.get(p.teslimLink) || { z: p.teslimZaman, n: 0, b: p.bolum }; t.n++; teslim.set(p.teslimLink, t) }
  for (const t of teslim.values()) l.push({ z: t.z, r: '--gon', t: `${bEt(t.b)}Animasal teslim linki gönderdi · ${t.n} plan` })
  for (const i of P.istekler || []) {
    const ne = `${bEt(i.bolum)}${i.plan ? planNo(i.plan) + ' · ' : ''}${ISTEK_AD[i.tur] || 'isteğiniz'}`
    const z = i.cevap?.yonetim?.zaman || i.islendi || i.zaman
    if (i.durum === 'islendi') l.push({ z, r: i.tur === 'karar' && i.veri?.karar === 'rev' ? '--rev' : '--ok', t: i.tur === 'link' ? `${bEt(i.bolum)}Linkiniz okundu, planlar oluştu` : `${ne} Animasal'a işlendi`, plan: i.plan })
    else if (i.durum === 'red') l.push({ z, r: '--rev', t: `${ne} kabul edilmedi${i.cevap?.not ? `: ${i.cevap.not}` : ''}`, plan: i.plan })
    else if (i.durum === 'ortak') l.push({ z, r: '--eks', t: `${ne} Animasal'ın kararını bekliyor`, plan: i.plan })
    else if (i.durum === 'karsi') l.push({ z, r: '--eks', t: `Animasal karşı öneri yaptı (${ne})${i.cevap?.metin ? `: “${i.cevap.metin}”` : ''}`, plan: i.plan })
    else if (i.durum === 'yeni' || i.durum === 'isleniyor') l.push({ z, r: '--sira', t: `${ne} Animasal'a iletiliyor…`, plan: i.plan })
  }
  return l.map((x) => ({ ...x, ms: Date.parse(x.z) || 0 })).filter((x) => x.ms).sort((a, b) => b.ms - a.ms).slice(0, 60)
}
const gorulen = () => +(al('pp-gordu-' + d.pid) || 0)
function bildirimPaneli() {
  const gordu = gorulen()
  const l = bildirimler(), yeni = l.filter((x) => x.ms > gordu).length
  return `<section class="pp-bildirim" id="ppBildirim" aria-label="Bildirimler"><div class="ppb-ust"><b>Bildirimler</b>${yeni ? `<span class="mp-rozet">${yeni} yeni</span>` : ''}<span class="gizli-not" style="margin-left:auto">Animasal'dan gelenler</span></div>
    <div class="ppb-liste">${l.map((x, i) => `<button class="ppb-satir${x.ms > gordu ? ' yeni' : ''}" data-bi="${i}" style="--r:var(${x.r})"><i></i><time>${esc(tarih(x.z))}</time><span>${esc(x.t)}</span></button>`).join('') || '<span class="gizli-not" style="padding:6px">Henüz bildirim yok.</span>'}</div></section>`
}

function ciz() {
  const korunan = yazilariAl()
  const P = d.proje, b = (P.bolumler || []).find((x) => x.no === d.bolum) || {}, c = sayac()
  const parca = (n, renk) => `<i style="width:${c.toplam ? (n / c.toplam) * 100 : 0}%;background:var(${renk})"></i>`
  const kutu = (k, ad) => `<button class="sayi" data-s="${k}" aria-pressed="${d.suzgec === k}"><b>${k === 'toplam' ? c.toplam : c[k]}</b><span>${ad}</span></button>`
  const q = d.ara.toLocaleUpperCase('tr')
  const bagli = new Map()
  for (const p of planlar()) if (p.anaPlan) bagli.set(p.anaPlan, [...(bagli.get(p.anaPlan) || []), p])
  const araUyar = (p) => !q || `${p.no} ${p.aciklama}`.toLocaleUpperCase('tr').includes(q)
  // 13.11 (Aytaç): onaylananlar altta ayrı, açılır "Onaylanan planlar" bölümünde (süzgeç "Onaylandı" ise üstte)
  const gor = planlar().filter((p) => !p.anaPlan && (d.suzgec === 'ok' || gorunenDurum(p) !== 'ok') && (!d.suzgec || d.suzgec === 'toplam' || (d.suzgec === 'kalan' ? ['sira', 'cal'].includes(gorunenDurum(p)) : gorunenDurum(p) === d.suzgec)) && araUyar(p))
  const okListe = d.suzgec === 'ok' ? [] : planlar().filter((p) => !p.anaPlan && gorunenDurum(p) === 'ok' && araUyar(p))
  const secilebilir = (p) => ['gon', 'rev', 'eks', 'ok'].includes(gorunenDurum(p))
  for (const id of [...d.secili]) if (!planlar().some((p) => p.id === id && secilebilir(p))) d.secili.delete(id)
  const gorSec = gor.filter(secilebilir)
  const satir = (p) => { const s = gorunenDurum(p), [ad, sinif] = DURUM[s] || DURUM.cal, karar = ['gon', 'rev', 'eks'].includes(s)
    return `<tr class="${p.acil ? 'acil' : ''}${d.secili.has(p.id) ? ' secili' : ''}"><td class="sec">${secilebilir(p) ? `<input type="checkbox" data-sec="${p.id}" ${d.secili.has(p.id) ? 'checked' : ''} aria-label="${esc(String(p.no).split(' ')[0])} planını seç">` : ''}</td><td class="no">${esc(String(p.no).split(' ')[0])}</td>
          <td class="acik">${esc(p.aciklama)}${(bagli.get(p.id) || []).map((x) => `<span class="bagli">↳ ${esc(String(x.no).split(' ')[0])} · ${esc(x.aciklama)} (aynı plan)</span>`).join('')}${p.animasalNot ? `<span class="not">Animasal notu: ${esc(p.animasalNot)}</span>` : ''}${p.musteriNot ? `<span class="pmusteri">Sizin notunuz: ${esc(p.musteriNot)}</span>` : ''}${bekleyenKarar(p.id) ? '<span class="pmusteri">Animasal\'a iletiliyor…</span>' : ''}</td>
          <td><span class="durum ${sinif}">${ad}</span></td>${P.ayar.tahminAcik ? `<td class="tt">${p.tahmin ? tarih(p.tahmin) + '<small>tahmini</small>' : '<small>—</small>'}</td>` : ''}
          <td>${['ipt', 'ok'].includes(s) ? '' : `<button class="acilbtn" data-acil="${p.id}" aria-pressed="${p.acil}">ACİL</button>`}</td>
          <td>${karar ? `<div class="karar"><button class="k-ok" data-k="ok" data-p="${p.id}">Onayla</button><button class="k-rev" data-k="rev" data-p="${p.id}">Revize</button><button class="k-eks" data-k="eks" data-p="${p.id}">Eksik</button></div>` : s === 'ok' ? `<div class="karar"><button class="k-rev" data-k="rev" data-p="${p.id}" title="Onayı geri alır, plan revizeye döner">Revize iste</button></div><small class="gizli-not">Onayı geri alır</small>` : s === 'ipt' ? '' : '<small class="gizli-not">Gönderilince karar verilir</small>'}<div id="not-${p.id}"></div><button class="msj-btn" data-msj="${esc(String(p.no).split(' ')[0])}">Bu plan hakkında yaz</button></td></tr>` }
  const sutun = P.ayar.tahminAcik ? 7 : 6
  d.ustSecilebilir = gorSec.map((p) => p.id)
  const acil = planlar().filter((p) => p.acil).length
  const ortak = (P.istekler || []).filter((i) => ['ortak', 'karsi'].includes(i.durum))
  $('#kok').innerHTML = `
  <header class="ust"><div class="dis"><img class="logo" alt="Animasal" src="logo.png"><div class="marka">Animasal <small>Post prod paneli</small></div>
    <div class="proje"><select id="proje" aria-label="Proje">${d.giris.projeler.map((p) => `<option value="${p.id}" ${p.id === d.pid ? 'selected' : ''}>${esc(p.ad)}</option>`).join('')}</select>
    <div class="kim"><span class="av">${esc((d.giris.eposta[0] || '?').toUpperCase())}</span>${esc(d.giris.eposta)}</div><button class="btn" id="cikis">Çıkış</button></div></div></header>
  <main class="dis">
    <nav class="sekmeler" role="tablist">${(P.bolumler || []).map((x) => `<button class="sekme" role="tab" aria-selected="${x.no === d.bolum}" data-b="${x.no}">${esc(x.ad || 'Bölüm ' + x.no)}<small>${x.teslimEdildi ? '✓' : tarih(x.teslim).split(' ')[0] || ''}</small></button>`).join('')}</nav>
    <div class="govde"><section>
      <div class="kart ozet"><div class="ozet-ust"><div><h1>${esc(P.ad)}${b.no != null ? ' · Bölüm ' + b.no : ''}${d.gorunum === 'tanitim' ? ' · Tanıtım' : ''}</h1><div class="alt">Bağlı planlar ana planla tek sayılır · iptaller hariç</div></div>
        <div class="teslim"><div><div class="etiket">Teslim tarihi</div><div class="tarih">${b.teslimEdildi ? 'Teslim edildi' : tarih(b.teslim)}</div></div>${!b.teslimEdildi && P.ayar.tarihDegistir ? `<button class="btn" id="tarihDegis">${(P.istekler || []).some((i) => i.tur === 'teslim-tarihi' && i.bolum === d.bolum && ['yeni', 'ortak', 'karsi'].includes(i.durum)) ? 'Tarih isteğiniz iletildi' : 'Tarihi değiştir'}</button>` : ''}</div></div>
        <div class="ozet-orta"><div class="sayilar">${kutu('toplam', 'Toplam plan')}${kutu('gon', 'Onayınızı bekliyor')}${kutu('ok', 'Onaylandı')}${kutu('rev', 'Revizede')}${kutu('eks', 'Eksik')}${kutu('kalan', "Animasal'da")}</div>${bildirimPaneli()}</div>
        <div class="cubuk" aria-hidden="true">${parca(c.ok, '--ok')}${parca(c.gon, '--gon')}${parca(c.rev, '--rev')}${parca(c.eks, '--eks')}${parca(c.kalan, '--sira-z')}</div>
        ${P.ayar.tahminAcik && b.tahmin ? `<div class="tahmin">Animasal'ın tahmini: bütün planlar <b>${tarih(b.tahmin)}</b> gönderilmiş olacak.</div>` : ''}
      </div>
      <div class="kart" style="margin-top:16px;overflow:hidden"><div class="arac">
        <div class="gorunum"><button class="gbtn" data-g="plan" aria-pressed="${d.gorunum === 'plan'}">Bölüm planları</button><button class="gbtn" data-g="tanitim" aria-pressed="${d.gorunum === 'tanitim'}">Tanıtım</button></div>
        <input id="ara" type="search" placeholder="Plan no ya da açıklama ara" value="${esc(d.ara)}">
        <span class="acil-say">Acil: <b>${acil}</b> / ${P.ayar.acilSinir}</span>
        <button class="btn ana" id="kalanlar" ${c.gon ? '' : 'disabled'}>Kalanları onayla (${c.gon})</button></div>
        ${d.secili.size ? `<div class="secim-serit" role="region" aria-label="Seçilen planlar"><b>${d.secili.size} plan seçildi</b><button class="btn ana" id="topOk">Onayla</button><button class="btn" id="topRev">Revize</button><button class="btn" id="topEks">Eksik</button><button class="btn" id="secKaldir">Seçimi kaldır</button></div>` : ''}
        <div class="tablo-kap"><table><thead><tr><th class="sec">${gorSec.length ? `<input type="checkbox" id="hepsiSec" ${gorSec.every((p) => d.secili.has(p.id)) ? 'checked' : ''} aria-label="Listedekilerin hepsini seç">` : ''}</th><th>Plan</th><th>Açıklama</th><th>Durum</th>${P.ayar.tahminAcik ? '<th>Tahmini</th>' : ''}<th>Acil</th><th>Kararınız</th></tr></thead><tbody>
        ${gor.map(satir).join('') || `<tr><td colspan="${sutun}" class="gizli-not">Plan yok.</td></tr>`}
        ${okListe.length ? `<tr class="ok-baslik"><td colspan="${sutun}"><button id="okAcKapa" aria-expanded="${d.okAcik}">${d.okAcik ? '▾' : '▸'} Onaylanan planlar (${okListe.length})</button><small class="gizli-not"> · fikriniz değişirse "Revize iste" ile onayı geri alabilirsiniz</small></td></tr>${d.okAcik ? okListe.map(satir).join('') : ''}` : ''}
        </tbody></table></div></div>
    </section>
    <aside class="yan">
      <div class="kart"><h2>Ortak kararlar</h2>${ortak.length ? ortak.map((i) => `<div class="istek"><b>${i.durum === 'ortak' ? "Animasal'ın cevabı bekleniyor" : 'Animasal karşı öneri yaptı'}</b><div>${esc(i.tur === 'acil' ? 'Acil isteği' : 'Teslim tarihi: ' + tarih(i.veri?.tarih))}</div>${i.durum === 'karsi' ? `<div>${esc(i.cevap?.metin || '')}</div><div class="satir"><button class="btn" data-ik="0" data-id="${i.id}">Kabul etmiyorum</button><button class="btn ana" data-ik="1" data-id="${i.id}">Kabul et</button></div>` : ''}</div>`).join('') : `<div class="gizli-not">Acil sınırı (${P.ayar.acilSinir}) üstü ve erken teslim tarihi Animasal'la birlikte kararlaştırılır.</div>`}</div>
      <div class="kart"><h2>${d.gorunum === 'tanitim' ? 'Tanıtım linkleri' : 'Plate linkleri'}</h2><div class="gizli-not">WeTransfer linkini yapıştırın; planlar Animasal'da kendiliğinden oluşur.</div>
        <form class="linkgir" id="linkForm"><input id="linkGir" placeholder="https://we.tl/…" aria-label="WeTransfer linki"><button class="btn">Ekle</button></form>
        ${bekleyenLinkler(b, d.gorunum === 'tanitim').map((l) => `<div class="link ${l.durum === 'red' ? 'link-red' : 'link-bekliyor'}"><code>${esc(l.link)}</code><small>${tarih(l.zaman)} · ${l.durum === 'red' ? `okunamadı${l.not ? ': ' + esc(l.not) : ''}` : "Animasal'a iletiliyor…"}</small></div>`).join('')}
        ${((d.gorunum === 'tanitim' ? b.tanitimLinkleri : b.linkler) || []).map((l) => `<div class="link"><code>${esc(l.link)}</code><small>${tarih(l.zaman)} · ${l.dosya} dosya</small></div>`).join('')}</div>
      <div class="kart"><h2>Animasal teslimleri</h2>${[...new Map(planlar().filter((p) => p.teslimLink).map((p) => [p.teslimLink, p])).values()].map((p) => `<div class="link"><code>${esc(p.teslimLink)}</code><small>${tarih(p.teslimZaman)} · ${planlar().filter((x) => x.teslimLink === p.teslimLink).length} plan</small></div>`).join('') || '<div class="gizli-not">Henüz teslim linki yok.</div>'}</div>
    </aside></div>
  </main>
  <aside class="mesaj-panel" id="mesajPanel" data-kapali="${d.mpKapali}"><div class="mp-bas"><h2>Animasal ile mesajlar</h2><span class="mp-rozet" ${d.mpKapali && d.okunmamis ? '' : 'hidden'}>${d.okunmamis || 0}</span><button class="btn" id="mpSes">${d.ses ? '🔔' : '🔕'}</button><button class="btn" id="mpAcKapa">${d.mpKapali ? 'Mesajlar' : 'Daralt'}</button></div>
    <div class="mp-govde" id="mpGovde">${(P.mesajlar || []).map((m) => `<div class="balon ${m.taraf === 'animasal' ? 'biz' : 'siz'}">${m.plan ? `<span class="plan-et">${esc(m.plan)}</span>` : ''}<span>${esc(m.metin)}</span><small>${esc(m.ad)} · ${tarih(m.zaman)}</small></div>`).join('')}</div>
    <div class="mp-kim">Yazan: <input id="mpKim" placeholder="adınız" value="${esc(al('pp-kim') || '')}"> <span>(ortak hesapta ayırmak için)</span></div>
    <form class="mp-yaz" id="mpForm"><textarea id="mpMetin" placeholder="${d.mpPlan ? esc(d.mpPlan) + ' hakkında yazın…' : 'Mesaj yazın…'}"></textarea><button class="btn ana">Gönder</button></form></aside>`
  document.body.classList.toggle('mp-acik', !d.mpKapali)
  baglantilar()
  yazilariKoy(korunan)
}

// Seçilen planlara aynı karar (13.11, Aytaç: çoklu seçim). Revize / eksikte tek not hepsine gider.
async function topluKarar(karar) {
  const idler = [...d.secili]
  if (!idler.length) return
  const ad = { ok: 'Onayla', rev: 'Revize', eks: 'Eksik' }[karar]
  const k = pencere(`<h3>${idler.length} plan · ${ad}</h3>${karar === 'ok' ? `<div>Seçilen <b>${idler.length} plan</b> ONAYLANDI olacak.</div>` : `<label>${karar === 'rev' ? 'Ne düzeltilecek? (bütün seçilenlere gider)' : 'Ne eksik? (bütün seçilenlere gider)'}<textarea id="topNot" rows="3"></textarea></label>`}
    <div class="satir"><button class="btn" data-v>Vazgeç</button><button class="btn ana" data-e>${idler.length} plana uygula</button></div>`)
  k.querySelector('[data-v]').onclick = () => k.remove()
  k.querySelector('[data-e]').onclick = async () => {
    const not = k.querySelector('#topNot')?.value.trim() || ''
    k.remove()
    let hata = 0
    for (const id of idler) {
      const r = await sb.rpc('musteri_istek', { p_pid: d.pid, p_bolum: d.bolum, p_plan: id, p_tur: 'karar', p_veri: { karar, ...(not ? { not } : {}) }, p_kim: al('pp-kim') || null })
      if (r.error) hata++
    }
    d.secili.clear()
    await yukle()
    tost(hata ? `${idler.length - hata} plan iletildi, ${hata} plan iletilemedi` : `${idler.length} plan ${({ ok: 'onaylandı', rev: 'revizeye gönderildi', eks: 'eksik bildirildi' })[karar]}`)
  }
}

function pencere(html) { const k = document.createElement('div'); k.className = 'perde'; k.innerHTML = `<div class="pencere">${html}</div>`; k.onclick = (e) => { if (e.target === k) k.remove() }; document.body.appendChild(k); return k }
function baglantilar() {
  $('#proje').onchange = (e) => { d.pid = e.target.value; d.bolum = null; yukle(); nabiz() }
  $('#cikis').onclick = async () => { await sb.auth.signOut(); location.reload() }
  $('#ara').oninput = (e) => { d.ara = e.target.value; ciz(); $('#ara').focus(); $('#ara').setSelectionRange(d.ara.length, d.ara.length) }
  $('#mpKim').onchange = (e) => { sakla('pp-kim', e.target.value.trim()); nabiz() }
  $('#mpSes').onclick = () => { d.ses = !d.ses; sakla('pp-ses', d.ses ? '1' : '0'); if (d.ses) ding(); ciz() }
  $('#mpAcKapa').onclick = () => { d.mpKapali = !d.mpKapali; if (!d.mpKapali) d.okunmamis = 0; sakla('pp-mesaj-kapali', d.mpKapali ? '1' : '0'); ciz() }
  $('#mpForm').onsubmit = async (e) => { e.preventDefault(); const v = $('#mpMetin').value.trim(); if (!v) return
    const r = await sb.rpc('musteri_mesaj', { p_pid: d.pid, p_metin: v, p_bolum: d.bolum, p_plan: d.mpPlan, p_kim: al('pp-kim') || null })
    if (r.error) return tost('Gönderilemedi: ' + r.error.message)
    $('#mpMetin').value = '' // gönderildi: yeniden çizimde geri konmasın
    d.mpPlan = null; yukle() }
  $('#linkForm').onsubmit = async (e) => { e.preventDefault(); const v = $('#linkGir').value.trim()
    if (!/we\.tl|wetransfer\.com/i.test(v)) return tost('Şimdilik yalnızca WeTransfer linki okunabiliyor. Başka servis için linki mesajla gönderin.')
    // listede hemen "iletiliyor…" diye görünür; kutu boşalır (olmazsa yazı geri gelir)
    const y = { link: v, tanitim: d.gorunum === 'tanitim', bolum: d.bolum, pid: d.pid, zaman: new Date().toISOString() }
    d.yerelLinkler.push(y); $('#linkGir').value = ''; ciz()
    if (await istek('link', { link: v, tanitim: y.tanitim })) tost("Link eklendi · Animasal'a iletiliyor")
    else { d.yerelLinkler = d.yerelLinkler.filter((x) => x !== y); ciz(); if ($('#linkGir')) $('#linkGir').value = v } }
  if ($('#tarihDegis')) $('#tarihDegis').onclick = () => {
    const b = (d.proje.bolumler || []).find((x) => x.no === d.bolum) || {}
    const yerel = (t) => { const z = t ? new Date(t) : new Date(Date.now() + 2 * 864e5); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 16) }
    const k = pencere(`<h3>Teslim tarihini değiştir</h3><label>Yeni teslim tarihi<input type="datetime-local" id="ttYeni" value="${yerel(b.teslim)}"></label>
      <div class="etki">${d.proje.ayar.tahminAcik && b.tahmin ? `Animasal'ın tahmini: <b>${tarih(b.tahmin)}</b>. Bundan erken bir tarih Animasal'ın onayına gider.` : "Yeni tarih Animasal'ın onayına gider; onaylanınca burada görünür."}</div>
      <div class="satir"><button class="btn" data-v>Vazgeç</button><button class="btn ana" data-e>İste</button></div>`)
    k.querySelector('[data-v]').onclick = () => k.remove()
    k.querySelector('[data-e]').onclick = async () => {
      const v = k.querySelector('#ttYeni').value
      if (!v) return tost('Tarih seçin')
      k.remove()
      const r = await istek('teslim-tarihi', { tarih: v })
      if (r) tost(r.ortak ? "Tarih isteğiniz Animasal'ın onayına gönderildi" : 'Teslim tarihi değiştirildi · Animasal’a iletildi')
    }
  }
  // çoklu seçim (üstteki "hepsini seç" yalnızca üst listedekileri seçer, onaylananları değil)
  document.querySelectorAll('[data-sec]').forEach((x) => (x.onchange = () => { x.checked ? d.secili.add(x.dataset.sec) : d.secili.delete(x.dataset.sec); ciz() }))
  if ($('#hepsiSec')) $('#hepsiSec').onchange = (e) => { for (const id of d.ustSecilebilir || []) e.target.checked ? d.secili.add(id) : d.secili.delete(id); ciz() }
  if ($('#secKaldir')) $('#secKaldir').onclick = () => { d.secili.clear(); ciz() }
  if ($('#topOk')) $('#topOk').onclick = () => topluKarar('ok')
  if ($('#topRev')) $('#topRev').onclick = () => topluKarar('rev')
  if ($('#topEks')) $('#topEks').onclick = () => topluKarar('eks')
  if ($('#okAcKapa')) $('#okAcKapa').onclick = () => { d.okAcik = !d.okAcik; ciz() }
  $('#kalanlar').onclick = () => { const n = sayac().gon; const k = pencere(`<h3>Kalanları onayla</h3><div>Onayınızı bekleyen <b>${n} plan</b> ONAYLANDI olacak. Revize ve eksik işaretledikleriniz değişmez.</div><div class="satir"><button class="btn" data-v>Vazgeç</button><button class="btn ana" data-e>${n} planı onayla</button></div>`)
    k.querySelector('[data-v]').onclick = () => k.remove(); k.querySelector('[data-e]').onclick = async () => { k.remove(); if (await istek('kalanlari-onayla', { planlar: planlar().filter((p) => gorunenDurum(p) === 'gon').map((p) => p.id) })) tost(n + ' plan onaylandı') } }
  const bp = $('#ppBildirim')
  if (bp) {
    const l = bildirimler()
    bp.onclick = () => { const son = l[0]?.ms; if (son && son > gorulen()) { sakla('pp-gordu-' + d.pid, String(son)); ciz() } }
    bp.querySelectorAll('[data-bi]').forEach((x) => (x.onclick = (e) => {
      const b = l[+x.dataset.bi]
      if (b?.msj) { d.mpKapali = false; d.okunmamis = 0; sakla('pp-mesaj-kapali', '0') }
      else if (b?.plan) d.ara = String((d.proje.planlar || []).find((p) => p.id === b.plan)?.no || '').split(' ')[0]
      sakla('pp-gordu-' + d.pid, String(l[0]?.ms || 0)); e.stopPropagation(); ciz()
    }))
  }
  document.querySelectorAll('[data-b]').forEach((x) => (x.onclick = () => { d.bolum = +x.dataset.b; d.suzgec = null; d.secili.clear(); ciz() }))
  document.querySelectorAll('[data-g]').forEach((x) => (x.onclick = () => { d.gorunum = x.dataset.g; d.suzgec = null; d.secili.clear(); ciz() }))
  document.querySelectorAll('[data-s]').forEach((x) => (x.onclick = () => { d.suzgec = d.suzgec === x.dataset.s ? null : x.dataset.s; ciz() }))
  document.querySelectorAll('[data-msj]').forEach((x) => (x.onclick = () => { d.mpPlan = x.dataset.msj; d.mpKapali = false; ciz(); $('#mpMetin').focus() }))
  document.querySelectorAll('[data-acil]').forEach((x) => (x.onclick = async () => { const acik = x.getAttribute('aria-pressed') !== 'true'
    const r = await istek('acil', { acil: acik }, x.dataset.acil); if (r) tost(r.ortak ? "Acil sınırı doldu: Animasal'la ortak karar isteği gönderildi" : acik ? "Acil yapıldı · Animasal'a iletildi" : 'Acil kaldırıldı') }))
  document.querySelectorAll('[data-ik]').forEach((x) => (x.onclick = async () => { await istek('ortak-cevap', { istek: +x.dataset.id, kabul: x.dataset.ik === '1' }) }))
  document.querySelectorAll('[data-k]').forEach((x) => (x.onclick = async () => {
    if (x.dataset.k === 'ok') { if (await istek('karar', { karar: 'ok' }, x.dataset.p)) tost('Onaylandı'); return }
    notKutusu(x.dataset.p, x.dataset.k)
  }))
}

basla()
