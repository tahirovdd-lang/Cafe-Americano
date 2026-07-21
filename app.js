import { loadOrders, loadProfile, saveOptimisticProfile } from './api.js';

const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();
try { tg?.setHeaderColor('#013F4A'); tg?.setBackgroundColor('#013F4A'); } catch (_) {}

const PRODUCTS = [
  {id:'espresso',cat:'hot',price:18000,meta:'30 мл',is_coffee:true,img:'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?auto=format&fit=crop&w=600&q=80',n:{ru:'Эспрессо',uz:'Espresso',en:'Espresso'}},
  {id:'americano',cat:'hot',price:22000,meta:'250 мл',is_coffee:true,img:'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80',n:{ru:'Американо',uz:'Amerikano',en:'Americano'}},
  {id:'cappuccino',cat:'hot',price:28000,meta:'300 мл',is_coffee:true,img:'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80',n:{ru:'Капучино',uz:'Kapuchino',en:'Cappuccino'}},
  {id:'latte',cat:'hot',price:30000,meta:'350 мл',is_coffee:true,img:'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80',n:{ru:'Латте',uz:'Latte',en:'Latte'}},
  {id:'iced_americano',cat:'cold',price:28000,meta:'400 мл',is_coffee:true,img:'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80',n:{ru:'Айс американо',uz:'Ays amerikano',en:'Iced Americano'}},
  {id:'iced_latte',cat:'cold',price:34000,meta:'400 мл',is_coffee:true,img:'https://images.unsplash.com/photo-1568649929103-28ffbefaca1e?auto=format&fit=crop&w=600&q=80',n:{ru:'Айс латте',uz:'Ays latte',en:'Iced Latte'}},
  {id:'cheesecake',cat:'dessert',price:35000,meta:'1 порция',is_coffee:false,img:'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80',n:{ru:'Чизкейк',uz:'Chizkeyk',en:'Cheesecake'}},
  {id:'chocolate_cake',cat:'dessert',price:38000,meta:'1 порция',is_coffee:false,img:'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80',n:{ru:'Шоколадный торт',uz:'Shokoladli tort',en:'Chocolate cake'}},
  {id:'croissant',cat:'food',price:20000,meta:'1 шт',is_coffee:false,img:'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',n:{ru:'Круассан',uz:'Kruassan',en:'Croissant'}},
  {id:'sandwich',cat:'food',price:39000,meta:'1 шт',is_coffee:false,img:'https://images.unsplash.com/photo-1553909489-cd47e0907980?auto=format&fit=crop&w=600&q=80',n:{ru:'Сэндвич',uz:'Sendvich',en:'Sandwich'}}
];

const I18N = {
  ru:{hot:'Горячий кофе',cold:'Холодный кофе',dessert:'Десерты',food:'Еда',all:'Все',menu:'Меню',cart:'Корзина',orders:'Мои заказы',profile:'Профиль',empty:'Корзина пустая',total:'Итого',left:'До бесплатного кофе осталось',gifts:'Получено подарков',coffeeTotal:'Всего учтено кофе',order:'Оформить заказ',branch:'Выберите филиал'},
  uz:{hot:'Issiq qahva',cold:'Sovuq qahva',dessert:'Desertlar',food:'Taomlar',all:'Barchasi',menu:'Menyu',cart:'Savat',orders:'Buyurtmalarim',profile:'Profil',empty:'Savat bo‘sh',total:'Jami',left:'Bepul qahvagacha qoldi',gifts:'Olingan sovg‘alar',coffeeTotal:'Jami qahva',order:'Buyurtma berish',branch:'Filialni tanlang'},
  en:{hot:'Hot coffee',cold:'Iced coffee',dessert:'Desserts',food:'Food',all:'All',menu:'Menu',cart:'Cart',orders:'My orders',profile:'Profile',empty:'Cart is empty',total:'Total',left:'Coffees left to a free one',gifts:'Free coffees received',coffeeTotal:'Total coffees',order:'Place order',branch:'Choose a branch'}
};

let lang = 'ru', category = 'all', fulfillment = 'pickup', payment = 'cash';
let profile = {progress:0,step:6,left:6,coffee_total:0,free_total:0};
const cart = {};
const $ = id => document.getElementById(id);
const money = n => Number(n).toLocaleString('ru-RU');

function toast(text){const el=$('toast');el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function cartCount(){return Object.values(cart).reduce((a,b)=>a+b,0)}
function cartTotal(){return PRODUCTS.reduce((s,p)=>s+(cart[p.id]||0)*p.price,0)}

function openScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));window.scrollTo({top:0,behavior:'smooth'});if(id==='ordersScreen') renderOrders()}
window.openScreen=openScreen;

function setCategory(cat){category=cat;openScreen('menuScreen');renderFilters();renderProducts()}
window.setCategory=setCategory;

function renderHomeCategories(){
  const cards=[
    ['hot','https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80'],
    ['cold','https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80'],
    ['dessert','https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80'],
    ['food','https://images.unsplash.com/photo-1553909489-cd47e0907980?auto=format&fit=crop&w=600&q=80']
  ];
  $('homeCats').innerHTML=cards.map(([key,img])=>`<article class="cat-card" style="background-image:url('${img}')" onclick="setCategory('${key}')"><b>${I18N[lang][key]}</b><i>›</i></article>`).join('');
}

function renderFilters(){
  const keys=['all','hot','cold','dessert','food'];
  $('filters').innerHTML=keys.map(k=>`<button class="pill ${category===k?'active':''}" onclick="window.pickFilter('${k}')">${I18N[lang][k]}</button>`).join('');
}
window.pickFilter=k=>{category=k;renderFilters();renderProducts()};

function renderProducts(){
  const list=PRODUCTS.filter(p=>category==='all'||p.cat===category);
  $('products').innerHTML=list.map(p=>`<article class="product"><img src="${p.img}" alt="${p.n[lang]}"><h4>${p.n[lang]}</h4><div class="meta">${p.meta}</div><div class="price">${money(p.price)} сум</div><div class="counter"><button onclick="changeQty('${p.id}',-1)">−</button><b>${cart[p.id]||0}</b><button onclick="changeQty('${p.id}',1)">+</button></div></article>`).join('');
}
window.changeQty=(id,delta)=>{cart[id]=Math.max(0,(cart[id]||0)+delta);renderProducts();renderCart()};

function renderCart(){
  const rows=PRODUCTS.filter(p=>cart[p.id]>0);
  $('cartLines').innerHTML=rows.length?rows.map(p=>`<div class="line"><span>${p.n[lang]} × ${cart[p.id]}</span><b>${money(p.price*cart[p.id])} сум</b></div>`).join(''):`<div class="empty">${I18N[lang].empty}</div>`;
  $('total').textContent=money(cartTotal());
  $('cartBadge').textContent=cartCount();
}

function renderProfile(){
  const step=profile.step||6, progress=profile.progress||0, left=profile.left ?? (step-progress);
  document.querySelectorAll('[data-progress]').forEach(el=>el.textContent=`${progress}/${step}`);
  document.querySelectorAll('[data-left]').forEach(el=>el.textContent=left);
  document.querySelectorAll('[data-total-coffee]').forEach(el=>el.textContent=profile.coffee_total||0);
  document.querySelectorAll('[data-gifts]').forEach(el=>el.textContent=profile.free_total||0);
  const ring=$('progressRing'); if(ring) ring.style.setProperty('--progress',`${Math.round(progress/step*100)}%`);
  document.querySelectorAll('.stamps').forEach(box=>{box.innerHTML=Array.from({length:step},(_,i)=>`<span class="stamp ${i<progress?'done':''}">${i<progress?'☕':i===step-1?'🎁':'○'}</span>`).join('')});
  $('profileName').textContent=profile.first_name||'Гость Americano';
  $('profileUsername').textContent=profile.username?`@${profile.username}`:'Telegram';
}

async function refreshProfile(){profile=await loadProfile();renderProfile()}

async function renderOrders(){
  const orders=await loadOrders();
  $('ordersList').innerHTML=orders.length?orders.map(o=>`<article class="order-card"><b>${o.order_id}</b><div class="meta">${String(o.created_at).replace('T',' ').slice(0,16)} · ${o.branch_name}</div><div class="line"><span>☕ ${o.coffee_qty} · 🎁 ${o.free_qty}</span><b>${money(o.final_total)} сум</b></div></article>`).join(''):`<div class="empty">История появится после первого заказа.</div>`;
}

function applyLanguage(){
  $('menuTitle').textContent=I18N[lang].menu;$('cartTitle').textContent=I18N[lang].cart;$('ordersTitle').textContent=I18N[lang].orders;$('profileTitle').textContent=I18N[lang].profile;$('totalLabel').textContent=I18N[lang].total;$('sendOrder').textContent=I18N[lang].order;
  renderHomeCategories();renderFilters();renderProducts();renderCart();renderProfile();
}

document.querySelectorAll('[data-lang]').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('[data-lang]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');lang=btn.dataset.lang;applyLanguage()});
document.querySelectorAll('.nav-btn').forEach(btn=>btn.onclick=()=>openScreen(btn.dataset.screen));
$('pickup').onclick=()=>{fulfillment='pickup';$('pickup').classList.add('active');$('delivery').classList.remove('active');$('address').style.display='none'};
$('delivery').onclick=()=>{fulfillment='delivery';$('delivery').classList.add('active');$('pickup').classList.remove('active');$('address').style.display='block'};
document.querySelectorAll('.pay').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.pay').forEach(x=>x.classList.remove('active'));btn.classList.add('active');payment=btn.dataset.pay});

$('sendOrder').onclick=()=>{
  const selected=PRODUCTS.filter(p=>cart[p.id]>0);if(!selected.length)return toast(I18N[lang].empty);
  const branch=$('branch');if(!branch.value)return toast(I18N[lang].branch);
  const phone=$('phone').value.trim();if(!phone)return toast('Введите номер телефона');
  if(fulfillment==='delivery'&&!$('address').value.trim())return toast('Введите адрес доставки');
  const items=selected.map(p=>({id:p.id,qty:cart[p.id],price:p.price,name_ru:p.n.ru,name_lang:p.n[lang],category:p.cat,is_coffee:p.is_coffee,meta:p.meta}));
  const coffeeQty=items.filter(i=>i.is_coffee).reduce((s,i)=>s+i.qty,0);
  const totalProgress=(profile.progress||0)+coffeeQty;
  const gifts=Math.floor(totalProgress/6);
  profile={...profile,progress:totalProgress%6,left:6-(totalProgress%6),coffee_total:(profile.coffee_total||0)+coffeeQty,free_total:(profile.free_total||0)+gifts};
  saveOptimisticProfile(profile);renderProfile();
  const payload={action:'order',brand:'AMERICANO',branch_id:branch.value,branch_name:branch.options[branch.selectedIndex].text,order_id:`AM-${Date.now()}`,items,total_num:cartTotal(),total:money(cartTotal()),phone,fulfillment,address:fulfillment==='delivery'?$('address').value.trim():'',payment_method:payment,payment_label:payment==='cash'?'Наличные':payment==='click'?'Click':'Карта',comment:$('comment').value.trim(),lang};
  tg?.sendData(JSON.stringify(payload));setTimeout(()=>tg?.close(),350);
};

window.requestCard=()=>{tg?.sendData(JSON.stringify({action:'card'}));toast('Карта отправлена в чат')};

renderHomeCategories();renderFilters();renderProducts();renderCart();applyLanguage();refreshProfile();
