import { loadOrders, loadProfile, saveLocalOrder, saveOptimisticProfile } from './api.js';

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
try {
  tg?.setHeaderColor('#013F4A');
  tg?.setBackgroundColor('#013F4A');
} catch (_) {}

const PRODUCTS = [
  {id:'espresso',cat:'hot',price:18000,meta:{ru:'30 мл',uz:'30 ml',en:'30 ml'},is_coffee:true,img:'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?auto=format&fit=crop&w=600&q=80',n:{ru:'Эспрессо',uz:'Espresso',en:'Espresso'}},
  {id:'americano',cat:'hot',price:22000,meta:{ru:'250 мл',uz:'250 ml',en:'250 ml'},is_coffee:true,img:'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085e3a?auto=format&fit=crop&w=600&q=80',n:{ru:'Американо',uz:'Amerikano',en:'Americano'}},
  {id:'cappuccino',cat:'hot',price:28000,meta:{ru:'300 мл',uz:'300 ml',en:'300 ml'},is_coffee:true,img:'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80',n:{ru:'Капучино',uz:'Kapuchino',en:'Cappuccino'}},
  {id:'latte',cat:'hot',price:30000,meta:{ru:'350 мл',uz:'350 ml',en:'350 ml'},is_coffee:true,img:'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80',n:{ru:'Латте',uz:'Latte',en:'Latte'}},
  {id:'iced_americano',cat:'cold',price:28000,meta:{ru:'400 мл',uz:'400 ml',en:'400 ml'},is_coffee:true,img:'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80',n:{ru:'Айс американо',uz:'Ays amerikano',en:'Iced Americano'}},
  {id:'iced_latte',cat:'cold',price:34000,meta:{ru:'400 мл',uz:'400 ml',en:'400 ml'},is_coffee:true,img:'https://images.unsplash.com/photo-1568649929103-28ffbefaca1e?auto=format&fit=crop&w=600&q=80',n:{ru:'Айс латте',uz:'Ays latte',en:'Iced Latte'}},
  {id:'cheesecake',cat:'dessert',price:35000,meta:{ru:'1 порция',uz:'1 porsiya',en:'1 serving'},is_coffee:false,img:'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80',n:{ru:'Чизкейк',uz:'Chizkeyk',en:'Cheesecake'}},
  {id:'chocolate_cake',cat:'dessert',price:38000,meta:{ru:'1 порция',uz:'1 porsiya',en:'1 serving'},is_coffee:false,img:'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80',n:{ru:'Шоколадный торт',uz:'Shokoladli tort',en:'Chocolate cake'}},
  {id:'croissant',cat:'food',price:20000,meta:{ru:'1 шт',uz:'1 dona',en:'1 pc'},is_coffee:false,img:'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',n:{ru:'Круассан',uz:'Kruassan',en:'Croissant'}},
  {id:'sandwich',cat:'food',price:39000,meta:{ru:'1 шт',uz:'1 dona',en:'1 pc'},is_coffee:false,img:'https://images.unsplash.com/photo-1553909489-cd47e0907980?auto=format&fit=crop&w=600&q=80',n:{ru:'Сэндвич',uz:'Sendvich',en:'Sandwich'}}
];

const I18N = {
  ru:{slogan:'Просто. Вкусно. С душой.',everySixth:'Каждый 6-й кофе',gift:'В подарок!',allBranches:'Действует во всех 3 филиалах',coffeeToGift:'кофе до подарка',details:'Подробнее',categories:'Категории',allMenu:'Всё меню',myCard:'Моя кофейная карта',coffeeWord:'кофе',giftLeft:'до подарка осталось',totalCoffeeShort:'Всего',giftsShort:'Подарков',openCard:'Открыть карту',hot:'Горячий кофе',cold:'Холодный кофе',dessert:'Десерты',food:'Еда',all:'Все',menu:'Меню',cart:'Корзина',orders:'Мои заказы',ordersNav:'Заказы',profile:'Профиль',home:'Главная',empty:'Корзина пустая',total:'Итого',order:'Оформить заказ',branch:'Выберите филиал',branch1:'Americano — Филиал 1',branch2:'Americano — Филиал 2',branch3:'Americano — Филиал 3',pickup:'Самовывоз',delivery:'Доставка',phone:'Номер телефона',address:'Адрес доставки',comment:'Комментарий',cash:'Наличные',card:'Карта',sum:'сум',progress:'Прогресс',leftProfile:'Осталось до подарка',totalCoffeeProfile:'Всего кофе',giftsProfile:'Получено подарков',welcome:'Добро пожаловать в Americano',historyEmpty:'История появится после первого заказа.',loading:'Загрузка…',enterPhone:'Введите номер телефона',enterAddress:'Введите адрес доставки',cardSent:'Карта отправлена в чат'},
  uz:{slogan:'Oddiy. Mazali. Mehr bilan.',everySixth:'Har 6-qahva',gift:'Sovg‘a!',allBranches:'Barcha 3 filialda amal qiladi',coffeeToGift:'qahvadan keyin sovg‘a',details:'Batafsil',categories:'Kategoriyalar',allMenu:'Barcha menyu',myCard:'Mening qahva kartam',coffeeWord:'qahva',giftLeft:'sovg‘agacha qoldi',totalCoffeeShort:'Jami',giftsShort:'Sovg‘alar',openCard:'Kartani ochish',hot:'Issiq qahva',cold:'Sovuq qahva',dessert:'Desertlar',food:'Taomlar',all:'Barchasi',menu:'Menyu',cart:'Savat',orders:'Buyurtmalarim',ordersNav:'Buyurtmalar',profile:'Profil',home:'Bosh sahifa',empty:'Savat bo‘sh',total:'Jami',order:'Buyurtma berish',branch:'Filialni tanlang',branch1:'Americano — 1-filial',branch2:'Americano — 2-filial',branch3:'Americano — 3-filial',pickup:'Olib ketish',delivery:'Yetkazib berish',phone:'Telefon raqami',address:'Yetkazib berish manzili',comment:'Izoh',cash:'Naqd pul',card:'Karta',sum:'so‘m',progress:'Jarayon',leftProfile:'Sovg‘agacha qoldi',totalCoffeeProfile:'Jami qahva',giftsProfile:'Olingan sovg‘alar',welcome:'Americano’ga xush kelibsiz',historyEmpty:'Birinchi buyurtmadan keyin tarix ko‘rinadi.',loading:'Yuklanmoqda…',enterPhone:'Telefon raqamini kiriting',enterAddress:'Yetkazib berish manzilini kiriting',cardSent:'Karta chatga yuborildi'},
  en:{slogan:'Simple. Delicious. With soul.',everySixth:'Every 6th coffee',gift:'Is free!',allBranches:'Valid at all 3 branches',coffeeToGift:'coffees left to your gift',details:'Details',categories:'Categories',allMenu:'Full menu',myCard:'My coffee card',coffeeWord:'coffee',giftLeft:'left until the gift',totalCoffeeShort:'Total',giftsShort:'Gifts',openCard:'Open card',hot:'Hot coffee',cold:'Iced coffee',dessert:'Desserts',food:'Food',all:'All',menu:'Menu',cart:'Cart',orders:'My orders',ordersNav:'Orders',profile:'Profile',home:'Home',empty:'Cart is empty',total:'Total',order:'Place order',branch:'Choose a branch',branch1:'Americano — Branch 1',branch2:'Americano — Branch 2',branch3:'Americano — Branch 3',pickup:'Pickup',delivery:'Delivery',phone:'Phone number',address:'Delivery address',comment:'Comment',cash:'Cash',card:'Card',sum:'UZS',progress:'Progress',leftProfile:'Left until gift',totalCoffeeProfile:'Total coffees',giftsProfile:'Gifts received',welcome:'Welcome to Americano',historyEmpty:'Your order history will appear after your first order.',loading:'Loading…',enterPhone:'Enter your phone number',enterAddress:'Enter the delivery address',cardSent:'Card sent to chat'}
};

let lang=localStorage.getItem('americano_lang')||'ru', category='all', fulfillment='pickup', payment='cash';
let profile={progress:0,step:6,left:6,coffee_total:0,free_total:0};
const cart={};
const $=id=>document.getElementById(id);
const t=key=>I18N[lang][key]||I18N.ru[key]||key;
const money=n=>Number(n).toLocaleString(lang==='en'?'en-US':'ru-RU');

function toast(text){const el=$('toast');el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function cartCount(){return Object.values(cart).reduce((a,b)=>a+b,0)}
function cartTotal(){return PRODUCTS.reduce((s,p)=>s+(cart[p.id]||0)*p.price,0)}
function openScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));window.scrollTo({top:0,behavior:'smooth'});if(id==='ordersScreen')renderOrders()}
window.openScreen=openScreen;
function setCategory(cat){category=cat;openScreen('menuScreen');renderFilters();renderProducts()}
window.setCategory=setCategory;
function renderHomeCategories(){const cards=[['hot','https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80'],['cold','https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80'],['dessert','https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80'],['food','https://images.unsplash.com/photo-1553909489-cd47e0907980?auto=format&fit=crop&w=600&q=80']];$('homeCats').innerHTML=cards.map(([key,img])=>`<article class="cat-card" style="background-image:url('${img}')" onclick="setCategory('${key}')"><b>${t(key)}</b><i>›</i></article>`).join('')}
function renderFilters(){const keys=['all','hot','cold','dessert','food'];$('filters').innerHTML=keys.map(k=>`<button class="pill ${category===k?'active':''}" onclick="window.pickFilter('${k}')">${t(k)}</button>`).join('')}
window.pickFilter=k=>{category=k;renderFilters();renderProducts()};
function renderProducts(){const list=PRODUCTS.filter(p=>category==='all'||p.cat===category);$('products').innerHTML=list.map(p=>`<article class="product"><img src="${p.img}" alt="${p.n[lang]}"><h4>${p.n[lang]}</h4><div class="meta">${p.meta[lang]}</div><div class="price">${money(p.price)} ${t('sum')}</div><div class="counter"><button onclick="changeQty('${p.id}',-1)">−</button><b>${cart[p.id]||0}</b><button onclick="changeQty('${p.id}',1)">+</button></div></article>`).join('')}
window.changeQty=(id,delta)=>{cart[id]=Math.max(0,(cart[id]||0)+delta);renderProducts();renderCart()};
function renderCart(){const rows=PRODUCTS.filter(p=>cart[p.id]>0);$('cartLines').innerHTML=rows.length?rows.map(p=>`<div class="line"><span>${p.n[lang]} × ${cart[p.id]}</span><b>${money(p.price*cart[p.id])} ${t('sum')}</b></div>`).join(''):`<div class="empty">${t('empty')}</div>`;$('total').textContent=money(cartTotal());$('cartBadge').textContent=cartCount()}
function renderProfile(){const step=profile.step||6,progress=profile.progress||0,left=profile.left??(step-progress);document.querySelectorAll('[data-progress]').forEach(el=>el.textContent=`${progress}/${step}`);document.querySelectorAll('[data-left]').forEach(el=>el.textContent=left);document.querySelectorAll('[data-total-coffee]').forEach(el=>el.textContent=profile.coffee_total||0);document.querySelectorAll('[data-gifts]').forEach(el=>el.textContent=profile.free_total||0);const ring=$('progressRing');if(ring)ring.style.setProperty('--progress',`${Math.round(progress/step*100)}%`);document.querySelectorAll('.stamps').forEach(box=>{box.innerHTML=Array.from({length:step},(_,i)=>`<span class="stamp ${i<progress?'done':''}">${i<progress?'☕':i===step-1?'🎁':'○'}</span>`).join('')});$('profileWelcome').textContent=t('welcome');const username=profile.username?`@${String(profile.username).replace(/^@/,'')}`:(profile.first_name||profile.last_name||'Telegram');$('profileUsername').textContent=username}
async function refreshProfile(){profile=await loadProfile();renderProfile()}
async function renderOrders(){$('ordersList').innerHTML=`<div class="empty">${t('loading')}</div>`;const orders=await loadOrders();$('ordersList').innerHTML=orders.length?orders.map(o=>`<article class="order-card"><b>${o.order_id}</b><div class="meta">${String(o.created_at).replace('T',' ').slice(0,16)} · ${o.branch_name}</div><div class="line"><span>☕ ${o.coffee_qty} · 🎁 ${o.free_qty}</span><b>${money(o.final_total)} ${t('sum')}</b></div></article>`).join(''):`<div class="empty">${t('historyEmpty')}</div>`}
function applyLanguage(){document.documentElement.lang=lang;document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));$('menuTitle').textContent=t('menu');$('cartTitle').textContent=t('cart');$('ordersTitle').textContent=t('orders');$('profileTitle').textContent=t('profile');$('totalLabel').textContent=t('total');$('sendOrder').textContent=t('order');$('pickup').textContent=t('pickup');$('delivery').textContent=t('delivery');$('phone').placeholder=t('phone');$('address').placeholder=t('address');$('comment').placeholder=t('comment');document.querySelector('[data-pay="cash"]').textContent=t('cash');document.querySelector('[data-pay="card"]').textContent=t('card');const branch=$('branch');branch.options[0].text=t('branch');branch.options[1].text=t('branch1');branch.options[2].text=t('branch2');branch.options[3].text=t('branch3');document.querySelectorAll('[data-lang]').forEach(x=>x.classList.toggle('active',x.dataset.lang===lang));renderHomeCategories();renderFilters();renderProducts();renderCart();renderProfile()}

document.querySelectorAll('[data-lang]').forEach(btn=>btn.onclick=()=>{lang=btn.dataset.lang;localStorage.setItem('americano_lang',lang);applyLanguage()});
document.querySelectorAll('.nav-btn').forEach(btn=>btn.onclick=()=>openScreen(btn.dataset.screen));
$('pickup').onclick=()=>{fulfillment='pickup';$('pickup').classList.add('active');$('delivery').classList.remove('active');$('address').style.display='none'};
$('delivery').onclick=()=>{fulfillment='delivery';$('delivery').classList.add('active');$('pickup').classList.remove('active');$('address').style.display='block'};
document.querySelectorAll('.pay').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.pay').forEach(x=>x.classList.remove('active'));btn.classList.add('active');payment=btn.dataset.pay});

$('sendOrder').onclick=()=>{
  const selected=PRODUCTS.filter(p=>cart[p.id]>0);
  if(!selected.length)return toast(t('empty'));
  const branch=$('branch');
  if(!branch.value)return toast(t('branch'));
  const phone=$('phone').value.trim();
  if(!phone)return toast(t('enterPhone'));
  if(fulfillment==='delivery'&&!$('address').value.trim())return toast(t('enterAddress'));

  const items=selected.map(p=>({id:p.id,qty:cart[p.id],price:p.price,name_ru:p.n.ru,name_lang:p.n[lang],category:p.cat,is_coffee:p.is_coffee,meta:p.meta[lang]}));
  const coffeeQty=items.filter(i=>i.is_coffee).reduce((s,i)=>s+i.qty,0);
  const totalProgress=(profile.progress||0)+coffeeQty;
  const gifts=Math.floor(totalProgress/6);
  profile={...profile,progress:totalProgress%6,left:6-(totalProgress%6),coffee_total:(profile.coffee_total||0)+coffeeQty,free_total:(profile.free_total||0)+gifts};
  saveOptimisticProfile(profile);
  renderProfile();

  const orderId=`AM-${Date.now()}`;
  const totalValue=cartTotal();
  const createdAt=new Date().toISOString();
  const payload={action:'order',brand:'AMERICANO',branch_id:branch.value,branch_name:branch.options[branch.selectedIndex].text,order_id:orderId,items,total_num:totalValue,total:money(totalValue),phone,fulfillment,address:fulfillment==='delivery'?$('address').value.trim():'',payment_method:payment,payment_label:payment==='cash'?t('cash'):payment==='click'?'Click':t('card'),comment:$('comment').value.trim(),lang};

  saveLocalOrder({
    order_id:orderId,
    branch_name:payload.branch_name,
    coffee_qty:coffeeQty,
    free_qty:gifts,
    final_total:totalValue,
    created_at:createdAt
  });

  tg?.sendData(JSON.stringify(payload));
  setTimeout(()=>tg?.close(),800);
};

window.requestCard=()=>{tg?.sendData(JSON.stringify({action:'card'}));toast(t('cardSent'))};
applyLanguage();
refreshProfile();
