(function(){
  'use strict';
  var root=document.documentElement, $=function(s){return document.querySelector(s)}, $$=function(s){return document.querySelectorAll(s)};
  var store={
    get:function(k,d){try{var v=localStorage.getItem('monyu-so:'+k);return v===null?d:v}catch(e){return d}},
    set:function(k,v){try{localStorage.setItem('monyu-so:'+k,v)}catch(e){}}
  };

  /* ================= Modo conta nova (usuário zerado) =================
     Segunda porta de entrada do login (?mode=zero), pra demonstrar a jornada guiada
     do zero: cadastro do 1º projeto até o workspace pronto pra submissão. Reseta o
     estado de progresso a CADA carregamento (repetível pra demos ao vivo), preservando
     só preferências de exibição (tema/fonte/contraste/sidebar). Nunca roda no link de
     demonstração populado — mantém v28 padrão idêntico ao v26 nesse fluxo. */
  var isZeroMode=(function(){try{return new URLSearchParams(window.location.search).get('mode')==='zero'}catch(e){return false}})();
  if(isZeroMode){
    document.body.classList.add('zero-account');
    try{
      var zmKeep=['monyu-so:theme','monyu-so:font','monyu-so:contrast','monyu-so:motion','monyu-so:sidebarCollapsed'];
      var zmRemove=[];
      for(var zi=0;zi<localStorage.length;zi++){
        var zk=localStorage.key(zi);
        if(zk&&zk.indexOf('monyu-so:')===0&&zmKeep.indexOf(zk)===-1)zmRemove.push(zk);
      }
      zmRemove.forEach(function(zk){localStorage.removeItem(zk)});
    }catch(e){}
  }

  /* ================= Dados (demo) ================= */
  var AG={
    rico:{name:'Rico',cost:'1',desc:'Varre centenas de fontes de fomento, calcula o match e mostra o checklist de premissas do edital para os seus projetos.'},
    iris:{name:'Íris',cost:'5',desc:'Avalia o potencial de captação do projeto — de forma avulsa ou para uma oportunidade específica.'},
    ada:{name:'Ada',cost:'20',desc:'Elabora o projeto para o edital selecionado. Todo output passa por revisão humana antes da submissão.'},
    aurora:{name:'Aurora',cost:'15',desc:'Mapa completo de oportunidades e tese de funding para o seu negócio. Entrega em PDF + HTML.'},
    kai:{name:'Kai',cost:'10',desc:'Sessão estruturada para validar o encaixe problema-solução antes de investir na escrita.'},
    mike:{name:'Mike',cost:'20',desc:'Tese de funding do seu negócio: cruza o momento atual com o potencial de incentivos fiscais, investimento, capital de risco e fomento internacional — além da subvenção econômica. Entrega radar de aderência, roadmap e checklist de ações.'}
  };

  /* ================= Campanha promocional sazonal =================
     Motor genérico de campanhas de desconto por tempo limitado. Uma única campanha ativa por vez
     no piloto, mas o formato (scope por agente, janela de datas) já comporta futuras campanhas
     avulsas (ex.: só um agente) sem mudar a lógica abaixo — só o objeto PROMO muda.
     Regra de negócio (não-negociável): nunca exibir preço com desconto sem deixar explícito que
     há desconto — todo ponto de preço "ao vivo" mostra o valor original riscado + o valor final. */
  var PROMO={
    active:true,
    id:'lancamento-plataforma',
    label:'Lançamento da plataforma',
    pct:50,
    scope:'all', // 'all' ou array de chaves de agente, ex. ['ada','kai']
    start:'2026-07-08',
    end:'2026-08-07'
  };
  function promoIsLive(){
    if(!PROMO.active)return false;
    var now=new Date();
    var start=new Date(PROMO.start+'T00:00:00');
    var end=new Date(PROMO.end+'T23:59:59');
    return now>=start&&now<=end;
  }
  function promoAppliesTo(key){
    if(!promoIsLive())return false;
    if(PROMO.scope==='all')return true;
    return PROMO.scope.indexOf(key)>-1;
  }
  function promoDaysLeft(){
    var end=new Date(PROMO.end+'T23:59:59');
    var diff=Math.ceil((end-new Date())/86400000);
    return Math.max(0,diff);
  }
  function promoEndLabel(){
    var d=new Date(PROMO.end+'T00:00:00');
    var dd=d.getDate(),mm=d.getMonth()+1;
    return (dd<10?'0':'')+dd+'/'+(mm<10?'0':'')+mm+'/'+d.getFullYear();
  }
  function promoScopeLabel(){
    if(PROMO.scope==='all')return 'Todos os agentes';
    return PROMO.scope.map(function(k){return AG[k]?AG[k].name:k}).join(', ');
  }
  function applyPromo(key,baseCost){
    if(!promoAppliesTo(key))return {orig:baseCost,final:baseCost,discounted:false};
    if(baseCost<=1)return {orig:baseCost,final:baseCost,discounted:false}; /* regra (2026-07-14): ações de 1 ficha nunca têm desconto — só a partir de 2 fichas */
    var final=Math.round(baseCost*(1-PROMO.pct/100));
    if(final<1)final=1; /* nunca cobra 0 fichas por uma execução real */
    return {orig:baseCost,final:final,discounted:true};
  }
  /* Fragmento HTML reutilizável para exibir um custo em fichas já considerando a campanha ativa.
     Sem desconto: "20 fichas". Com desconto: "<s>20</s> <b>10</b> fichas -50%". */
  function costBadgeHTML(key,baseCost,opts){
    opts=opts||{};
    var unit=opts.unit||'ficha',suffix=opts.suffix||'';
    var r=applyPromo(key,baseCost);
    var word=function(n){return n===1?unit:unit+'s'};
    if(!r.discounted)return '<span class="promo-value">'+r.orig+' '+word(r.orig)+suffix+'</span>';
    /* tudo dentro de .promo-value: se não couber ao lado do rótulo, o bloco INTEIRO desce de linha
       (herda o flex-wrap do container pai) — mas nunca quebra no meio, entre o riscado e o valor final. */
    return '<span class="promo-value"><s class="promo-strike">'+r.orig+'</s> <b class="promo-final">'+r.final+'</b> '+word(r.final)+suffix+' <span class="promo-tag">-'+PROMO.pct+'%</span></span>';
  }
  /* Versão texto puro (sem tags), para contextos que não renderizam HTML — ex.: atributos data-tip. */
  function costPlainText(key,baseCost,unit){
    unit=unit||'ficha';
    var r=applyPromo(key,baseCost);
    var word=function(n){return n===1?unit:unit+'s'};
    if(!r.discounted)return r.orig+' '+word(r.orig);
    return r.final+' '+word(r.final)+' (-'+PROMO.pct+'%, antes '+r.orig+')';
  }
  /* Igual ao costBadgeHTML, mas para uma faixa [min,max] (ex.: preço de lote do Rico ou o total do runModal). */
  function rangeLabelPromo(key,baseRange){
    if(!baseRange)return '—';
    var fmt=function(r){return r[0]===r[1]?String(r[0]):(r[0]+'–'+r[1])};
    /* usa o .discounted resolvido por applyPromo em cada ponta (não só promoAppliesTo) — assim uma faixa
       degenerada como [1,1] (ex.: Rico com 1 projeto) nunca aparece com selo de desconto, mesmo com a
       campanha ativa, porque a regra de "sem desconto em ações de 1 ficha" já vale ficha a ficha. */
    var lo=applyPromo(key,baseRange[0]),hi=applyPromo(key,baseRange[1]);
    if(!lo.discounted&&!hi.discounted)return '<span class="promo-value">'+fmt(baseRange)+' ficha'+(baseRange[1]>1?'s':'')+'</span>';
    var finalRange=[lo.final,hi.final];
    return '<span class="promo-value"><s class="promo-strike">'+fmt(baseRange)+'</s> <b class="promo-final">'+fmt(finalRange)+'</b> ficha'+(finalRange[1]>1?'s':'')+' <span class="promo-tag">-'+PROMO.pct+'%</span></span>';
  }

  /* ================= Recompensas (níveis, selos, missões, pontuação) =================
     Fronteira de escopo (decisão do Evandro, 2026-07-09): a plataforma não observa
     submissão, avaliação ou aprovação real do cliente junto ao financiador — por isso
     NENHUM selo/missão depende desse dado. Ver 01-negocio-e-estrategia.md seção 3.2.1 e
     05-piloto-so-agentico-ui.md (memória: monyu-scope-boundary-plataforma).
     Modelo de pontuação (v25, 2026-07-13): Pontuação MonyU = XP base (contínuo, por ação,
     mecanismo antigo preservado em rwAddXp) + Bônus de badges (rwAddBadgePts, na conquista
     de cada nível/one-shot). Badges não são a única fonte de pontos — o XP base continua
     rodando por fora, em paralelo.
     Catálogo (v25): badges individuais por agente + badges de família (versatilidade,
     nível = nº de agentes distintos usados, capado no tamanho real da família — não força
     5 níveis onde não cabe) + Marcos + Memória + Domínio + GigaMonyU (categoria própria)
     + Eventos (one-shot por edição) + Parceiros (one-shot, autodeclarado nesta fase — token/
     hash do parceiro é evolução futura, ver 05-piloto-so-agentico-ui.md).
     IMPORTANTE: este bloco precisa ficar ANTES de qualquer código que chame rwPaidTrainingsUnlocked/
     rwLevelInfo em nível superior do script (ex.: renderTrainings() na inicialização) — são
     `var`s e só existem de fato após esta linha rodar; um bug de ordem já causou tela em
     branco (v24, corrigido). As chamadas reais de rwRecalcAll()/rwSyncChip() ficam lá embaixo,
     perto de renderTrainings() — nunca aqui em cima. */
  var RW_LEVELS=[
    {id:0,name:'Bronze',xpMin:0,ring:'#A9754F',ico:'🥉',benefit:null,benefitLabel:'Sua jornada na MonyU começa aqui'},
    {id:1,name:'Prata',xpMin:300,ring:'#B8BCC4',ico:'🥈',benefit:null,benefitLabel:'Acesso antecipado a novidades da plataforma'},
    {id:2,name:'Ouro',xpMin:900,ring:'#D4AF37',ico:'🥇',benefit:{type:'discount',pct:5},benefitLabel:'5% de desconto em pacotes avulsos de fichas'},
    {id:3,name:'Platina',xpMin:2200,ring:'#C9CBE0',ico:'✨',benefit:{type:'discount',pct:8},benefitLabel:'8% de desconto em pacotes avulsos de fichas + suporte prioritário'},
    {id:4,name:'Diamante',xpMin:4500,ring:'#FFD6E6',ico:'💎',benefit:{type:'unlock'},benefitLabel:'Treinamentos pagos desbloqueados + 8% de desconto em fichas'}
  ];
  var RW_CATS={
    agentes:{name:'Agentes',shape:'circle',color:'#FF0055'},
    marcos:{name:'Marcos de negócio',shape:'diamond',color:'#FF7300'},
    conhecimento:{name:'Memória',shape:'hex',color:'#FFCC00'},
    dominio:{name:'Domínio da plataforma',shape:'shield',color:'#8A8A8A'},
    giga:{name:'GigaMonyU',shape:'link',color:'#3E7CB1',desc:'Rede de consultores, pesquisadores e ICTs verificados pela MonyU. Vire membro pra conectar com eles, e pra ganhar fichas ajudando outros projetos.'},
    eventos:{name:'Eventos',shape:'star',color:'#993556'},
    parceiros:{name:'Parceiros',shape:'rosette',color:'#3C8A5C'}
  };
  var RW_CAT_ORDER=['agentes','marcos','conhecimento','dominio','giga','eventos','parceiros'];
  var LV5PTS=[10,25,60,150,400];
  function rwXp(){return parseInt(store.get('rw-xp','0'),10)}
  function rwBadgePts(){return parseInt(store.get('rw-badgepts','0'),10)}
  function rwScore(){return rwXp()+rwBadgePts()}
  function rwLevelInfo(){
    var xp=rwScore(),cur=RW_LEVELS[0];
    for(var i=0;i<RW_LEVELS.length;i++){if(xp>=RW_LEVELS[i].xpMin)cur=RW_LEVELS[i]}
    var next=RW_LEVELS[cur.id+1]||null;
    return {level:cur,next:next,xp:xp};
  }
  function rwDiscountPct(){
    var b=rwLevelInfo().level.benefit;
    if(b&&b.type==='discount')return b.pct;
    if(rwLevelInfo().level.id>=4)return 8;
    return 0;
  }
  function rwPaidTrainingsUnlocked(){return rwLevelInfo().level.id>=4}
  function rwSyncAvatarRing(){
    var lv=rwLevelInfo().level;
    $$('.avatar').forEach(function(el){el.style.boxShadow='0 0 0 2px var(--surface),0 0 0 4px '+lv.ring});
  }
  function rwSyncChip(){
    var li=rwLevelInfo();
    var navTag=$('#rwNavTag');if(navTag)navTag.textContent=li.level.name;
    var chip=$('#rwChip');
    if(chip){
      var lvEl=chip.querySelector('.rw-chip-lv');if(lvEl)lvEl.textContent=li.level.name;
      var bar=chip.querySelector('.rw-chip-bar i');
      if(bar){
        var pct=li.next?Math.round((li.xp-li.level.xpMin)/(li.next.xpMin-li.level.xpMin)*100):100;
        bar.style.width=pct+'%';
      }
    }
    rwSyncAvatarRing();
  }
  /* Celebração de upgrade de nível (2026-07-14): substitui o toast simples por um overlay curto —
     anel do novo nível + benefício desbloqueado por extenso. O confete/scale-in usa @keyframes puro
     em CSS, então a regra global de html[data-motion="reduced"] (linha ~35 do CSS) já desliga tudo
     sozinha quando o usuário reduziu animações — o card continua aparecendo, só sem movimento. */
  function rwShowLevelUpModal(lv){
    var m=$('#levelUpModal');if(!m)return;
    var ring=$('#lvupRing');
    if(ring){ring.style.setProperty('--lvc',lv.ring);ring.textContent=lv.ico||'🏅'}
    var nameEl=$('#lvupName');if(nameEl)nameEl.textContent=lv.name;
    var benEl=$('#lvupBenefit');if(benEl)benEl.textContent=lv.benefitLabel+'.';
    open(m);
  }
  function rwLevelCheckAndToast(beforeId){
    var afterId=rwLevelInfo().level.id;
    if(afterId>beforeId){
      var lv=RW_LEVELS[afterId];
      rwShowLevelUpModal(lv);
    }
    rwSyncChip();
    var rv=$('#view-rewards');
    if(rv&&rv.classList.contains('active'))renderRewards();
  }
  function rwAddXp(n){
    if(!n)return;
    var before=rwLevelInfo().level.id;
    store.set('rw-xp',String(rwXp()+n));
    rwLevelCheckAndToast(before);
  }
  function rwAddBadgePts(n){
    if(!n)return;
    var before=rwLevelInfo().level.id;
    store.set('rw-badgepts',String(rwBadgePts()+n));
    rwLevelCheckAndToast(before);
  }
  function rwCnt(key){return parseInt(store.get('rw-cnt-'+key,'0'),10)}
  function rwCntInc(key,n){n=n||1;store.set('rw-cnt-'+key,String(rwCnt(key)+n));return rwCnt(key)}
  function rwWeekKey(d){
    d=d||new Date();
    var onejan=new Date(d.getFullYear(),0,1);
    var week=Math.ceil((((d-onejan)/86400000)+onejan.getDay()+1)/7);
    return d.getFullYear()+'-w'+week;
  }
  function rwWeeksActive(){try{return JSON.parse(store.get('rw-weeks','[]')).length}catch(e){return 0}}
  function rwTrackWeek(){
    var wk=rwWeekKey(),list=[];
    try{list=JSON.parse(store.get('rw-weeks','[]'))}catch(e){list=[]}
    if(list.indexOf(wk)===-1){list.push(wk);store.set('rw-weeks',JSON.stringify(list))}
  }
  function rwAgentUsedCount(k){if(k==='ada')return rwCnt('adaprojects');return rwCnt(k)}
  function famLevel(members){return members.filter(function(k){return rwAgentUsedCount(k)>0}).length}
  function rwHas(id){return store.get('rw-badge-'+id,'')==='1'}
  function rwUnlock(id){
    if(rwHas(id))return;
    var a=RW_ONESHOTS.filter(function(x){return x.id===id})[0];
    if(!a)return;
    store.set('rw-badge-'+id,'1');
    toast('🏅 Selo desbloqueado: '+a.name+' (+'+a.pts+' pts)');
    rwAddBadgePts(a.pts);
  }
  function rwLadderLevel(id){return parseInt(store.get('rw-lvl-'+id,'0'),10)}
  function rwLadderCheck(b){
    var cnt=b.counter(),newLvl=0;
    for(var i=0;i<b.th.length;i++){if(cnt>=b.th[i])newLvl=i+1}
    var stored=rwLadderLevel(b.id);
    if(newLvl>stored){
      var gained=0;
      for(var i=stored;i<newLvl;i++)gained+=b.pts[i];
      store.set('rw-lvl-'+b.id,String(newLvl));
      if(gained>0){toast('🏅 '+b.name+' — nível '+newLvl+' alcançado (+'+gained+' pts)');rwAddBadgePts(gained)}
      return true;
    }
    return false;
  }
  function rwRecalcAll(){RW_LADDERS.forEach(function(b){rwLadderCheck(b)})}

  var RW_ONESHOTS=[
    {id:'boasvindas',cat:'dominio',name:'Boas-vindas',ico:'👋',desc:'Concluiu o tutorial de boas-vindas.',how:'Abra o tutorial de boas-vindas e passe pelas telas.',nav:null,navLbl:null,pts:50},
    {id:'gigaativado',cat:'giga',name:'Conta GigaMonyU ativada',ico:'🔓',desc:'Ativou a conta gratuita no GigaMonyU.',how:'Ative sua conta gratuita (freemium) direto na tela do GigaMonyU.',nav:'giga',navLbl:'Ver GigaMonyU',pts:50},
    {id:'gigaperfil',cat:'giga',name:'Perfil completo no GigaMonyU',ico:'🧾',desc:'Completou os campos do perfil no GigaMonyU.',how:'Complete seu perfil na tela do GigaMonyU.',nav:'giga',navLbl:'Ver GigaMonyU',pts:30},
    {id:'evt-verao2026-participante',cat:'eventos',name:'Desafio de Verão 2026',ico:'🎪',desc:'Participou do Desafio de Verão 2026.',how:'Fique de olho nos avisos de campeonatos internos da MonyU.',nav:null,navLbl:null,pts:100},
    {id:'sp-sebrae',cat:'parceiros',name:'Capital Empreendedor (Sebrae)',ico:'🤝',logo:'assets/parceiros/capital-empreendedor.webp',desc:'Participação confirmada no Capital Empreendedor, do Sebrae.',how:'Autodeclare sua participação — validação por token do parceiro é evolução futura.',nav:null,navLbl:null,pts:300,selfDeclared:true},
    {id:'sp-senac',cat:'parceiros',name:'Empreenda SENAC',ico:'🤝',logo:'assets/parceiros/empreenda-senac.jpg',desc:'Participação confirmada na competição Empreenda SENAC.',how:'Autodeclare sua participação — validação por token do parceiro é evolução futura.',nav:null,navLbl:null,pts:300,selfDeclared:true},
    {id:'sp-simbora',cat:'parceiros',name:'Simbora! (FAPEAL/SECTI/LIINC)',ico:'🤝',logo:'assets/parceiros/simbora.png',desc:'Participação confirmada no Simbora!, preparatório do Centelha 3 Alagoas.',how:'Autodeclare sua participação — validação por token do parceiro é evolução futura.',nav:null,navLbl:null,pts:300,selfDeclared:true},
    {id:'sp-cesar',cat:'parceiros',name:'Dates (Instituto CESAR)',ico:'🤝',logo:'assets/parceiros/dates-cesar.png',desc:'Participação confirmada na plataforma Dates, do Instituto CESAR.',how:'Autodeclare sua participação — validação por token do parceiro é evolução futura.',nav:null,navLbl:null,pts:300,selfDeclared:true},
    {id:'sp-founders',cat:'parceiros',name:'Growth Challenge (Founders Club)',ico:'🤝',logo:'assets/parceiros/founders-club.jpeg',desc:'Participação confirmada no Growth Challenge, do Founders Club.',how:'Autodeclare sua participação — validação por token do parceiro é evolução futura.',nav:null,navLbl:null,pts:300,selfDeclared:true},
    {id:'sp-aws',cat:'parceiros',name:'AWS Activate',ico:'🤝',logo:'assets/parceiros/aws-activate.png',desc:'Participação confirmada no programa AWS Activate.',how:'Autodeclare sua participação — validação por token do parceiro é evolução futura.',nav:null,navLbl:null,pts:300,selfDeclared:true},
    {id:'sp-voesemasas',cat:'parceiros',name:'Impulso (Voe Sem Asas)',ico:'🤝',logo:'assets/parceiros/voe-sem-asas.jpg',desc:'Participação confirmada no Impulso, da Voe Sem Asas.',how:'Autodeclare sua participação — validação por token do parceiro é evolução futura.',nav:null,navLbl:null,pts:300,selfDeclared:true},
    {id:'sp-globaleawards',cat:'parceiros',name:'Global eAwards (NTT Data Foundation)',ico:'🤝',logo:'assets/parceiros/global-eawards.png',desc:'Participação confirmada no Global eAwards — parceiro oficial da MonyU.',how:'Autodeclare sua participação — validação por token do parceiro é evolução futura.',nav:null,navLbl:null,pts:300,selfDeclared:true}
  ];
  var GIGA_CONN=[{status:'ok'},{status:'wait'}];
  function mkAgentLadder(id,name,ico,agentKey,th){
    return {id:id,cat:'agentes',kind:'ladder',name:name,ico:ico,desc:'Profundidade de uso — '+name,
      counter:function(){return rwCnt(agentKey)},th:th,pts:LV5PTS};
  }
  var RW_LADDERS=[
    mkAgentLadder('ag-rico','Radar ligado (Rico)','📡','rico',[1,4,10,22,40]),
    mkAgentLadder('ag-iris','Diagnóstico na mão (Íris)','🔎','iris',[1,3,6,10,15]),
    mkAgentLadder('ag-aurora','Mapa de oportunidades (Aurora)','🧭','aurora',[1,2,3,5,7]),
    mkAgentLadder('ag-mike','Tese de funding (Mike)','🧭','mike',[1,2,3,5,7]),
    mkAgentLadder('ag-kai','Problema validado (Kai)','🧩','kai',[1,3,6,10,15]),
    mkAgentLadder('ag-barto','Decisão fundamentada (Bartô)','⚖️','barto',[1,2,3,5,7]),
    mkAgentLadder('ag-carlito','Documentação em dia (Carlito)','🗂','carlito',[1,4,8,15,25]),
    mkAgentLadder('ag-banca','Prova de fogo (Banca)','⚖️','banca',[1,3,6,10,15]),
    mkAgentLadder('ag-clara','Contas em dia (Clara)','🧾','clara',[1,2,3,5,7]),
    mkAgentLadder('ag-eros','Equipe certa (Eros)','🤝','eros',[1,4,8,15,25]),
    {id:'fam-descoberta',cat:'agentes',kind:'family',name:'Descoberta & Estratégia',ico:'🧭',desc:'Versatilidade — Rico, Aurora e Mike.',
      counter:function(){return famLevel(['rico','aurora','mike'])},th:[1,2,3],pts:[30,90,220]},
    {id:'fam-validacao',cat:'agentes',kind:'family',name:'Validação, Viabilidade & Elaboração',ico:'✍️',desc:'Versatilidade — Íris, Kai, Bartô, Ada e Carlito.',
      counter:function(){return famLevel(['iris','kai','barto','ada','carlito'])},th:[1,2,3,4,5],pts:[30,90,220,450,800]},
    {id:'fam-aprovacao',cat:'agentes',kind:'family',name:'Aprovação & Pós-captação',ico:'🏁',desc:'Versatilidade — Banca, Clara e Eros.',
      counter:function(){return famLevel(['banca','clara','eros'])},th:[1,2,3],pts:[30,90,220]},
    {id:'mk-adaprojeto',cat:'marcos',kind:'ladder',name:'Projeto no forno (Ada)',ico:'✍️',desc:'Projetos criados com a Ada.',
      counter:function(){return rwCnt('adaprojects')},th:[1,2,4,7,12],pts:LV5PTS},
    {id:'mk-submissao',cat:'marcos',kind:'ladder',name:'Projeto pronto para submissão',ico:'📄',desc:'Projetos com as 6 seções copiadas no workspace da Ada.',
      counter:function(){return rwCnt('submissionready')},th:[1,2,4,7,12],pts:LV5PTS},
    {id:'mk-reengaja',cat:'marcos',kind:'ladder',name:'De volta para captar de novo',ico:'🔁',desc:'Projetos concluídos adaptados para um novo edital.',
      counter:function(){return rwCnt('reengage')},th:[1,2,4,7,12],pts:LV5PTS},
    {id:'cn-conhecimento',cat:'conhecimento',kind:'ladder',name:'Memória MonyU',ico:'🎓',desc:'Trilhas de treinamento concluídas.',
      counter:function(){return (typeof trAllKeys==='function'&&typeof TRAILS!=='undefined')?trAllKeys().filter(function(x){return TRAILS[x].lessons.every(function(l){return l.done})}).length:0},
      th:[1,2,4,7,12],pts:LV5PTS},
    {id:'cn-constante',cat:'conhecimento',kind:'ladder',name:'Uso constante',ico:'📆',desc:'Semanas diferentes com uso da plataforma.',
      counter:function(){return rwWeeksActive()},th:[2,5,10,16,26],pts:LV5PTS},
    {id:'dm-nocontrole',cat:'dominio',kind:'ladder',name:'No controle',ico:'🎚',desc:'Ativações do modo automático.',
      counter:function(){return rwCnt('autopilot')},th:[1,2,4,7,12],pts:LV5PTS},
    {id:'gg-rede',cat:'giga',kind:'ladder',name:'Rede ativa',ico:'🔗',desc:'Conexões aceitas com prestadores verificados.',
      counter:function(){return GIGA_CONN.filter(function(c){return c.status==='ok'}).length},th:[1,3,6,10,15],pts:LV5PTS},
    /* "Revisor GigaMonyU" — desenhada junto com a mecânica de reconhecimento
       do membro (mockup _mockups/mockup-gigamonyu-ganhos.html): cada revisão
       de projeto CONCLUÍDA como prestador soma aqui. Adicionada ao catálogo
       porque faz parte do desenho já aprovado, mas o counter fica travado em
       0 de propósito — este piloto só tem a persona de quem contrata, não
       existe ainda o evento real de "concluir uma revisão pra outro projeto"
       pra contar. Não usar o contador de solicitações feitas (specConfirmRequest)
       aqui: seria creditar "revisões que você FEZ" por uma ação de "revisão
       que você PEDIU" — dois papéis diferentes, não dá pra fingir que são
       a mesma coisa mesmo em demo. */
    {id:'gg-revisor',cat:'giga',kind:'ladder',name:'Revisor GigaMonyU',ico:'📝',desc:'Revisões de projeto concluídas como membro do GigaMonyU.',
      counter:function(){return 0},th:[1,3,6,10,15],pts:LV5PTS}
  ];

  function rwShapeSVG(shape,fill,stroke){
    var sw=stroke?3:0,st=stroke||'none',s='';
    if(shape==='circle')s='<circle cx="24" cy="24" r="20" fill="'+fill+'" stroke="'+st+'" stroke-width="'+sw+'"/>';
    else if(shape==='diamond')s='<polygon points="24,4 44,24 24,44 4,24" fill="'+fill+'" stroke="'+st+'" stroke-width="'+sw+'"/>';
    else if(shape==='hex')s='<polygon points="24,3 43,13 43,35 24,45 5,35 5,13" fill="'+fill+'" stroke="'+st+'" stroke-width="'+sw+'"/>';
    else if(shape==='shield')s='<path d="M24 3 L43 10 V23 C43 35 35 43 24 45 C13 43 5 35 5 23 V10 Z" fill="'+fill+'" stroke="'+st+'" stroke-width="'+sw+'"/>';
    else if(shape==='star')s='<polygon points="24,2 29,17 45,17 32,27 37,43 24,33 11,43 16,27 3,17 19,17" fill="'+fill+'" stroke="'+st+'" stroke-width="'+sw+'"/>';
    else if(shape==='rosette')s='<circle cx="24" cy="19" r="16" fill="'+fill+'" stroke="'+st+'" stroke-width="'+sw+'"/><polygon points="15,31 19,46 24,37 29,46 33,31" fill="'+fill+'"/>';
    else if(shape==='link')s='<circle cx="16" cy="24" r="11" fill="none" stroke="'+fill+'" stroke-width="6"/><circle cx="32" cy="24" r="11" fill="none" stroke="'+fill+'" stroke-width="6"/>';
    else if(shape==='cluster3')s='<circle cx="16" cy="17" r="10" fill="'+fill+'"/><circle cx="32" cy="17" r="10" fill="'+fill+'" opacity=".85"/><circle cx="24" cy="32" r="10" fill="'+fill+'" opacity=".7"/>';
    return '<svg viewBox="0 0 48 48" width="52" height="52" aria-hidden="true">'+s+'</svg>';
  }
  function rwOneshotCard(a){
    var got=rwHas(a.id),cat=RW_CATS[a.cat];
    var fill=got?cat.color:'var(--surface-1)',stroke=got?null:'var(--border)';
    var logoImg=a.logo?'<img src="'+a.logo+'" alt="" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:62%;max-height:62%;object-fit:contain;border-radius:6px;background:#fff;padding:3px">':'';
    var icoHtml=a.logo?'':'<span class="rw-shape-ico">'+(got?a.ico:'?')+'</span>';
    return '<div class="rw-card'+(got?' on':'')+'">'+
      '<div class="rw-shape">'+rwShapeSVG(cat.shape,fill,stroke)+icoHtml+logoImg+'</div>'+
      '<b>'+a.name+'</b><span class="rw-desc">'+(got?a.desc:a.how)+'</span>'+
      (a.selfDeclared&&!got?'<button class="btn-ghost rw-declare" data-rwdeclare="'+a.id+'">Autodeclarar participação</button>':'')+
      (got?'<span class="rw-tag'+(a.selfDeclared?' sd':'')+'">✓ '+(a.selfDeclared?'autodeclarado':'conquistado')+'</span>':'<span class="rw-tag pend">bloqueado</span>')+
    '</div>';
  }
  function rwLadderCard(b){
    var lvl=rwLadderLevel(b.id),cnt=b.counter(),cat=RW_CATS[b.cat],max=b.th.length;
    var shape=b.kind==='family'?'cluster3':cat.shape;
    var ring=lvl>0?RW_LEVELS[Math.min(lvl-1,4)].ring:'var(--border)';
    var fill=lvl>0?cat.color:'var(--surface-1)';
    var nextTh=b.th[lvl]!==undefined?b.th[lvl]:null;
    var prevTh=lvl>0?b.th[lvl-1]:0;
    var pct=nextTh?Math.max(4,Math.round((cnt-prevTh)/(nextTh-prevTh)*100)):100;
    return '<div class="rw-card'+(lvl>0?' on':'')+'">'+
      '<div class="rw-shape">'+rwShapeSVG(shape,fill,ring)+
        '<span class="rw-shape-ico">'+(lvl>0?'':'?')+'</span>'+
        (lvl>0?'<span class="rw-lvlnum">'+lvl+'</span>':'')+
      '</div>'+
      '<b>'+b.name+' <span class="rw-maxof">'+lvl+'/'+max+'</span></b>'+
      '<span class="rw-desc">'+b.desc+'</span>'+
      (nextTh!==null?'<div class="fichas-bar rw-mini-bar"><i style="width:'+pct+'%"></i></div><span class="rw-prog">'+cnt+'/'+nextTh+'</span>':'<span class="rw-tag">nível máximo</span>')+
    '</div>';
  }
  function renderRewards(){
    var el=$('#rwBody');if(!el)return;
    var li=rwLevelInfo();
    var levelsHtml=RW_LEVELS.map(function(lv){
      var reached=li.level.id>=lv.id,cur=li.level.id===lv.id;
      return '<div class="rw-lv-step'+(reached?' done':'')+(cur?' cur':'')+'"'+(reached?' style="border-color:'+lv.ring+'"':'')+'>'+
        /* #000 e não #1A1A1A: sobre o bronze (#A9754F, a cor mais clara dos
           anéis de nível) o cinza-escuro dava 4.43:1, logo abaixo do AA. */
        '<span class="rw-lv-ico"'+(reached?' style="background:'+lv.ring+';color:#000"':'')+'>'+(reached?'✓':(lv.id+1))+'</span>'+
        '<b>'+lv.name+'</b><span>'+lv.benefitLabel+'</span></div>';
    }).join('<span class="rw-lv-sep">→</span>');
    var pctNext=li.next?Math.round((li.xp-li.level.xpMin)/(li.next.xpMin-li.level.xpMin)*100):100;
    var totalBadges=RW_ONESHOTS.length+RW_LADDERS.length;
    var gotCount=RW_ONESHOTS.filter(function(a){return rwHas(a.id)}).length+RW_LADDERS.filter(function(b){return rwLadderLevel(b.id)>0}).length;
    var body=
      '<div class="rw-hero">'+
        '<div class="rw-hero-top"><span class="rw-hero-lv">Nível '+li.level.name+'</span>'+
        '<span class="rw-hero-xp">'+li.xp+' pts'+(li.next?' · faltam '+(li.next.xpMin-li.xp)+' pts para '+li.next.name:' · nível máximo')+'</span></div>'+
        '<div class="fichas-bar rw-hero-bar"><i style="width:'+pctNext+'%"></i></div>'+
        '<p class="rw-hero-benefit">🎁 '+li.level.benefitLabel+'</p>'+
      '</div>'+
      '<div class="rw-lv-road">'+levelsHtml+'</div>'+
      '<div class="section-head"><h2>Selos ('+gotCount+' de '+totalBadges+')</h2></div>';
    RW_CAT_ORDER.forEach(function(catKey){
      var cat=RW_CATS[catKey];
      var oneshots=RW_ONESHOTS.filter(function(a){return a.cat===catKey});
      var ladders=RW_LADDERS.filter(function(b){return b.cat===catKey});
      if(!oneshots.length&&!ladders.length)return;
      /* Ajuda contextual só na categoria GigaMonyU (2026-08-06): é a única
         categoria cujo nome sozinho não explica o que é nem por que
         importa pra quem ainda não é membro — as outras (Agentes, Memória,
         Domínio da plataforma...) já são autoexplicativas dentro do app.
         Reaproveita o MESMO sistema de tooltip [data-tip] do resto do
         produto (não um padrão novo) + navega pra GigaMonyU no clique,
         pra também servir de convite, não só explicação. */
      var catHelp=(catKey==='giga'&&cat.desc)
        ? '<a class="rw-cat-help" href="#" data-nav="giga" data-tip="'+cat.desc+'" aria-label="O que é GigaMonyU — ver e conhecer">'+
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.6-2.4 2.2-2.4 3.7M12 17h.01"/></svg></a>'
        : '';
      body+='<div class="rw-cat-head"><span class="rw-cat-dot" style="background:'+cat.color+'"></span><b>'+cat.name+'</b>'+catHelp+'</div>'+
        '<div class="rw-badges-grid">'+ladders.map(rwLadderCard).join('')+oneshots.map(rwOneshotCard).join('')+'</div>';
    });
    el.innerHTML=body;
    el.querySelectorAll('[data-rwdeclare]').forEach(function(btn){
      btn.addEventListener('click',function(){rwUnlock(btn.getAttribute('data-rwdeclare'))});
    });
  }

  /* ================= Ícone de identidade do projeto (decisão de 2026-07-14) =================
     Antes todo card de projeto novo usava o mesmo avatar do Rico — impossível diferenciar dois
     projetos recém-criados numa lista. Padrão novo: iniciais do nome + cor determinística pelo
     TEMA do projeto (mesma lista fixa do <select id="npTema">), reaproveitando cores já usadas em
     outros lugares do app para não introduzir paleta nova. Os avatares de agente (Rico, Ada etc.)
     continuam existindo — só não representam mais "este é o projeto X" no card. */
  var TEMA_COLORS={
    'Energia':'#FF7300','Agro':'#3C8A5C','Biotec':'#3E7CB1','Saúde':'#FF6FA5',
    'ESG':'#FFCC00','Cyber':'#8A8A8A','Nanotec':'#4A47A3','Outra':'#993556'
  };
  var PROJ_STOP=['de','da','do','das','dos','e','em','para','com','a','o','à','às'];
  function projInitials(name){
    var raw=(name||'').trim();
    if(!raw)return '?';
    var words=raw.split(/\s+/).filter(function(w){return w&&PROJ_STOP.indexOf(w.toLowerCase())===-1});
    if(words.length===0)words=raw.split(/\s+/);
    if(words.length===1)return words[0].substring(0,2).toUpperCase();
    return (words[0][0]+words[1][0]).toUpperCase();
  }
  function projIconHTML(name,tema){
    var color=TEMA_COLORS[tema]||TEMA_COLORS['Outra'];
    return '<span class="av proj-ico" style="--pic:'+color+'" aria-hidden="true">'+projInitials(name)+'</span>';
  }

  var PROJECTS={
    p1:{name:'Sistema de gestão inteligente de microrredes solares',short:'Microrredes solares',complete:false,stage:'elaborating',tema:'Energia'},
    p2:{name:'Plataforma IoT de monitoramento energético em tempo real',short:'Plataforma IoT',complete:false,stage:'diagnosed',tema:'Energia'},
    p3:{name:'Baterias de segunda vida para armazenamento industrial',short:'Baterias de segunda vida',complete:true,stage:'submitted',tema:'Energia'},
    p4:{name:'Hidrogênio verde para frotas logísticas',short:'Hidrogênio verde',complete:false,stage:'new',tema:'Energia'}
  };
  /* Recomendação local para a seção de ação de UMA oportunidade específica (chips diag/adapt/psf
     já existentes nesse fluxo) — versão rápida por estágio do projeto, sem considerar as
     exigências do edital. A recomendação completa por projeto×oportunidade (que já pesa
     contrapartida, parceria, TRL etc.) é nextBestAction(), usada nos cards e no modal. */
  function rowRecommendedAct(proj){
    if(proj.complete)return 'adapt';
    if(proj.stage==='new')return 'diag';
    return 'psf';
  }

  /* ================= Motor de recomendação contextual (v29) =================
     Por que existe: até a v28 a plataforma tratava a jornada como uma fila fixa
     (Rico → Íris → Carlito → Ada → A Banca) e os agentes estratégicos ficavam
     num balde separado de "apoio". Na prática é o contrário: para uma ideia
     ainda crua, ou para um edital que cobra fundamentação de mercado, rodar Kai
     ou Bartô ANTES da Ada é o que aumenta a chance de aprovação — escrever cedo
     demais só produz um projeto bem redigido sobre uma tese frágil.

     O motor responde "qual o próximo passo para ESTE projeto, considerando ESTE
     edital e o que já foi feito", e devolve junto o porquê em linguagem simples.
     A recomendação nunca bloqueia: o catálogo completo continua a um clique, e o
     usuário pode ignorar e rodar qualquer agente que quiser. */

  /* O que já rodou em cada projeto. No piloto é demonstração; na plataforma real
     vem do histórico de execuções. Serve para não recomendar o que já foi feito. */
  var PROJ_RAN={p1:['rico','iris','ada'],p2:['rico','iris'],p3:['rico','iris','ada','banca'],p4:[]};
  if(isZeroMode)Object.keys(PROJ_RAN).forEach(function(k){PROJ_RAN[k]=[]});
  function jaRodou(pid,agent){return (PROJ_RAN[pid]||[]).indexOf(agent)!==-1}

  /* Perfil de exigência do edital, derivado dos dados que o próprio edital já
     tem (contrapartida, categoria, requisitos) — nada é cadastrado à mão. É isso
     que permite dizer "este edital pede X, então vale rodar Y antes".

     Cada dimensão devolve uma FORÇA (0 = não pede, 1..3 = pede cada vez mais),
     não um booleano. A primeira versão usava booleanos e o resultado foi que
     todo edital acendia "exige problema" — porque praticamente toda chamada de
     PD&I cita TRL em algum requisito. Sinal que acende sempre não discrimina
     nada, e o efeito prático era o Kai ser recomendado em 100% dos casos,
     enterrando Bartô e Eros. Peso graduado + sinal específico resolve. */
  function editalProfile(opp){
    if(!opp)return {};
    var req=(opp.requisitos||[]).join(' ').toLowerCase();
    var obj=String(opp.objetivo||'').toLowerCase();
    var txt=req+' '+obj;
    var cpNum=parseInt((String(opp.contrapartida||'').match(/(\d+)\s*%/)||[])[1],10);
    if(isNaN(cpNum))cpNum=0;

    /* TRL citado no edital. TRL baixo (1-4) = tecnologia ainda em validação,
       onde caracterizar o problema vale muito. TRL alto (5+) = já validada,
       o gargalo passa a ser outro. */
    var trl=(txt.match(/trl\s*(\d)/)||[])[1];
    trl=trl?parseInt(trl,10):null;

    return {
      contrapartidaPct:cpNum,
      /* Contrapartida = dinheiro da empresa no projeto. Até 20% é praxe no
         mercado; acima disso vira decisão de capital, não de escrita. */
      forcaViabilidade: cpNum>=30?3:(cpNum>=20?2:0),
      /* Parceria obrigatória é bloqueante: sem parceiro não existe submissão,
         por isso pesa mais que qualquer outro sinal. */
      forcaParceiro: (opp.fcat==='cooperativo'||/em parceria|cooperativ|unidade embrapii|com ict|distribuidora participante/.test(txt))?3:0,
      /* Problema mal caracterizado: só conta quando o edital explicita risco
         tecnológico OU trabalha com TRL baixo — não pelo mero uso da sigla. */
      forcaProblema: (/risco de pd&i|desafio tecnológico/.test(txt)?2:0)+((trl!==null&&trl<=4)?1:0),
      /* Exigência documental pesada (certidões, regularidade, tempo de CNPJ):
         é o que costuma atrasar submissão na última semana. */
      forcaDocs: (/certid|cnd|fgts|cndt|regularidade/.test(txt)?2:0)+(/receita operacional|cnpj ativ/.test(txt)?1:0)
    };
  }

  /* Núcleo do motor. Devolve {agent, why, costNum, tag} ou null.
     `why` é sempre uma frase curta em linguagem de negócio — nunca jargão de
     produto ("rodar o gate N3") nem promessa de resultado ("garante aprovação"). */
  function nextBestAction(pid,oppId){
    var p=PROJECTS[pid]; if(!p)return null;
    var opp=oppId?OPPS.filter(function(o){return o.id===oppId})[0]:null;
    var prof=editalProfile(opp);
    var oppNome=opp?opp.abbr:null;
    /* Aderência deste projeto a este edital, calculada pelo Rico. Match baixo não
       significa "desista": significa que a tese ainda está fraca para esta banca,
       e que trabalhar o problema/estratégia rende mais do que escrever agora. */
    var match=null;
    if(opp&&opp.matches){
      var m=opp.matches.filter(function(x){return x.p===pid})[0];
      if(m)match=m.pct;
    }

    /* 1. Projeto já submetido: nada a fazer até sair o resultado. A plataforma
       não recebe retorno automático do financiador — quem informa é o usuário. */
    if(p.stage==='submitted')
      return {agent:null,tag:'aguardando',
        why:'Projeto submetido. Quando sair o resultado, registre aqui para acompanharmos o retorno do investimento.'};

    /* 2. Projeto sem nenhuma oportunidade mapeada: começar pelo radar (1 ficha). */
    if(p.stage==='new'&&!jaRodou(pid,'rico'))
      return {agent:'rico',costNum:1,tag:'comece por aqui',
        why:'Este projeto ainda não passou pelo radar. Por 1 ficha o Rico encontra os editais em que ele tem chance real.'};

    /* 3. Sem diagnóstico: saber se vale competir custa 5 fichas e evita gastar 20
       elaborando para um edital em que o projeto não tem aderência. */
    if(!jaRodou(pid,'iris'))
      return {agent:'iris',costNum:5,tag:'antes de investir',
        why:'Antes de elaborar, vale saber se o projeto tem aderência. O diagnóstico da Íris custa 5 fichas e evita gastar 20 no edital errado.'};

    /* 4. Gates estratégicos — o coração do motor. Cada um pontua conforme o
       quanto ESTE edital o exige; vence o de maior peso, e só se o peso passar
       do mínimo. Concorrem entre si em vez de disparar em cascata: assim um
       edital cooperativo puxa o Eros, um de contrapartida pesada puxa o Bartô,
       e um de tecnologia imatura puxa o Kai — em vez de sempre o primeiro da
       lista. Todos valem apenas ANTES da elaboração: depois que a Ada escreveu,
       a informação chega tarde para mudar o rumo do projeto. */
    if(opp&&!jaRodou(pid,'ada')){
      var gates=[
        {agent:'eros',peso:prof.forcaParceiro,costNum:5,tag:'este edital exige',
         why:'A '+oppNome+' só aceita projeto em parceria com ICT ou instituição credenciada. O Eros encontra parceiros compatíveis na rede MonyU — sem isso, não há submissão possível.'},
        {agent:'barto',peso:prof.forcaViabilidade,costNum:15,tag:'decisão de capital',
         why:'A '+oppNome+' exige contrapartida de '+prof.contrapartidaPct+'% — dinheiro seu no projeto. O Bartô confronta a viabilidade antes de você assumir esse compromisso.'},
        /* Aderência fraca (50-64%) = a tese existe mas não convence esta banca;
           a causa costuma estar no problema mal delimitado, terreno do Kai. */
        {agent:'kai',peso:prof.forcaProblema+(match!==null&&match>=50&&match<65?2:0),costNum:10,tag:'fortaleça antes',
         why:(match!==null&&match>=50&&match<65
           ? 'A aderência deste projeto à '+oppNome+' está em '+match+'% — abaixo do que costuma passar. O Kai investiga a causa e ajuda a fechar a distância antes de você gastar 20 fichas elaborando.'
           : 'A '+oppNome+' avalia o risco tecnológico do que você propõe. Uma sessão com o Kai deixa o problema bem caracterizado antes da escrita — é o que o avaliador lê primeiro.')},
        /* Aderência muito baixa (<50%) não se conserta reescrevendo: é sinal de
           edital errado. Aqui o ganho está em reabrir a rota, não em insistir —
           por isso pesa mais que o Kai nessa faixa. */
        {agent:'aurora',peso:(match!==null&&match<50?4:0),costNum:15,tag:'repense a rota',
         why:'A aderência à '+oppNome+' está em apenas '+match+'%. Insistir neste edital custa caro para uma chance pequena — a Aurora mapeia onde este projeto realmente compete, e costuma achar rota que ninguém tinha olhado.'}
      ].filter(function(g){return g.peso>=2&&!jaRodou(pid,g.agent)});
      if(gates.length){
        gates.sort(function(a,b){return b.peso-a.peso});
        return gates[0];
      }
    }

    /* 5. Documentação: entra perto da elaboração, quando já se sabe que o projeto
       vai andar — não faz sentido levantar certidão de projeto que não avançou. */
    if(opp&&prof.forcaDocs>=2&&jaRodou(pid,'ada')&&!jaRodou(pid,'carlito'))
      return {agent:'carlito',costNum:5,tag:'não deixe para o fim',
        why:'A '+oppNome+' pede certidões e comprovações que levam dias para sair. O Carlito monta o checklist agora, enquanto ainda dá tempo.'};

    /* 6. Projeto 100% elaborado na plataforma: adaptar sai por 5 em vez de 20. */
    if(p.complete)
      return {agent:'ada',costNum:5,tag:'reaproveite',
        why:'Este projeto já está completo na plataforma. Adaptar para um novo edital custa 5 fichas, não 20.'};

    /* 7. Escrito mas não avaliado: passar pela Banca antes de submeter. */
    if(jaRodou(pid,'ada')&&!jaRodou(pid,'banca'))
      return {agent:'banca',costNum:10,tag:'antes de submeter',
        why:'O projeto está escrito. A Banca simula a avaliação do edital e aponta o que ainda perde ponto — enquanto dá para corrigir.'};

    /* 8. Caminho padrão: diagnosticado, sem bloqueio estratégico → elaborar. */
    return {agent:'ada',costNum:20,tag:'próximo passo',
      why:'O diagnóstico já aprovou este projeto e não há pendência estratégica. A Ada elabora seção por seção no formato do edital.'};
  }

  /* ================= Modos de exposição (v29) =================
     A plataforma tem 11 agentes, 9 telas e ~24 controles fixos. Mostrar tudo
     isso no primeiro acesso é o que faz um produto completo parecer complicado.

     O modo controla DENSIDADE (quanta informação a Home abre de uma vez), nunca
     ACESSO: em qualquer modo o catálogo completo continua a um clique na barra
     lateral, e nenhum agente é escondido — o cliente paga pelos 11. O modo sobe
     sozinho conforme o uso real; não há wizard perguntando "você é iniciante?",
     porque ninguém se autodeclara iniciante e a resposta envelhece rápido. */
  var MODOS={essencial:1,assistido:2,avancado:3};
  function nivelDeUso(){
    /* Sinais de que o usuário já domina o básico. Deliberadamente simples e
       auditável — o usuário pode ver por que subiu de modo. */
    var projAtivos=Object.keys(PROJECTS).filter(function(k){return PROJECTS[k].stage!=='submitted'}).length;
    var agentesUsados={};
    Object.keys(PROJ_RAN).forEach(function(k){(PROJ_RAN[k]||[]).forEach(function(a){agentesUsados[a]=1})});
    var qtdAgentes=Object.keys(agentesUsados).length;
    var temAutonomiaAlta=Object.keys(AUT_LVL).some(function(k){return AUT_LVL[k]>=3});
    var usouAprovacoes=store.get('usouAprovacoes','0')==='1';

    if(projAtivos>=3||temAutonomiaAlta||usouAprovacoes)return MODOS.avancado;
    if(qtdAgentes>=3||projAtivos>=2)return MODOS.assistido;
    return MODOS.essencial;
  }
  /* Permite fixar o modo manualmente (Configurações) — quem quer tudo aberto
     desde o primeiro dia não deveria precisar "merecer" a interface completa. */
  function modoAtual(){
    var forcado=store.get('modoExposicao','auto');
    if(forcado!=='auto'&&MODOS[forcado])return MODOS[forcado];
    return nivelDeUso();
  }
  function modoNome(n){return n===3?'avancado':(n===2?'assistido':'essencial')}
  function aplicarModo(){
    var m=modoAtual();
    root.setAttribute('data-modo',modoNome(m));
    return m;
  }
  function setModoManual(nome){store.set('modoExposicao',nome);return aplicarModo()}
  /* ================= Jornada recomendada (urgência) ================= */
  var JORNADA=[
    {agent:'ada',proj:'p1',days:25,here:true,label:'Ada · elaboração',
      detail:'Microrredes solares está 68% pronto e o FINEP fecha em 25 dias. Termine a metodologia esta semana.',
      actionLabel:'Continuar',actionCost:20,btnClass:'btn-primary',dataAgent:'ada',dataProj:'p1'},
    {agent:'barto',proj:'p2',days:12,label:'Bartô · gate de viabilidade',
      detail:'A Plataforma IoT tem 78% de match, mas o edital exige contrapartida e parceria. Valide a tese antes de investir na elaboração.',
      action:'Conhecer o gate',btnClass:'btn-ghost',dataAgKey:'barto'},
    {agent:'rico',proj:'p4',days:null,label:'Rico · scan de oportunidades',
      detail:'Projeto novo ainda sem radar. Um scan do Rico encontra as primeiras oportunidades por 1 ficha.',
      actionLabel:'Executar scan',actionCost:1,btnClass:'btn-ghost',dataAgent:'rico',dataProj:'p4'}
  ];
  function urgencyTier(days){
    if(days==null)return 'none';
    if(days<15)return 'high';
    if(days<=30)return 'mid';
    return 'low';
  }
  function flowCard(j,idx){
    var tier=urgencyTier(j.days);
    var daysLabel=j.days==null?'sem prazo definido':'⏱ '+j.days+' dias';
    var btnAttrs=(j.dataAgent?' data-agent="'+j.dataAgent+'" data-proj="'+j.dataProj+'"':'')+(j.dataOpp?' data-opp="'+j.dataOpp+'"':'')+(j.dataAgKey?' data-agkey="'+j.dataAgKey+'"':'');
    var actionHtml=j.dataAgent?(j.actionLabel+' · '+costBadgeHTML(j.dataAgent,j.actionCost)):j.action;
    return '<div class="flow-step'+(j.here?' here':'')+'" style="animation-delay:.'+(3+idx*6)+'s">'+
      (j.here?'<span class="flow-here">você está aqui</span>':'')+
      '<span class="flow-num">'+(idx+1)+'</span>'+
      '<span class="flow-days tier-'+tier+'">'+daysLabel+'</span>'+
      '<b class="flow-proj">'+PROJECTS[j.proj].short+'</b>'+
      '<span class="flow-agent-line">'+j.label+'</span>'+
      '<p>'+j.detail+'</p>'+
      '<button class="'+j.btnClass+'"'+btnAttrs+' style="font-size:.76rem">'+actionHtml+'</button>'+
    '</div>';
  }
  function renderJornada(){
    var fl=$('#flowList');if(fl)fl.innerHTML=JORNADA.map(flowCard).join('');
    var fe=$('#flowEmpty');if(fe)fe.style.display=JORNADA.length?'none':'';
    var urgentes=JORNADA.filter(function(j){return j.days!=null&&j.days<=30});
    var chip=$('#urgentChipBtn');
    if(chip){
      if(urgentes.length){
        chip.style.display='';
        $('#urgentChipTxt').textContent=urgentes.length+' prazo'+(urgentes.length>1?'s':'')+' urgente'+(urgentes.length>1?'s':'');
      }else{chip.style.display='none'}
    }
    var ul=$('#urgentList');
    if(ul){
      ul.innerHTML=urgentes.map(function(j){
        var tier=urgencyTier(j.days);
        return '<button class="notif-item urgent-item" data-urgent-jump="'+JORNADA.indexOf(j)+'">'+
          '<svg class="av" aria-hidden="true"><use href="'+avatarHref(j.agent)+'"/></svg>'+
          '<p><span class="flow-days tier-'+tier+'" style="margin-bottom:.3rem;display:inline-block">⏱ '+j.days+' dias</span><br>'+
          '<b>'+PROJECTS[j.proj].short+'</b> — '+j.detail+'</p>'+
        '</button>';
      }).join('');
    }
  }
  var AGLABEL={rico:'scan de oportunidades',iris:'diagnóstico de elegibilidade',ada:'elaboração de projeto',aurora:'discovery estratégico',kai:'sessão PSF',mike:'tese de funding'};
  var ACTIONS={
    diag:{key:'iris',label:'Diagnóstico Íris',cost:5},
    psf:{key:'kai',label:'PSF com Kai',cost:10},
    adapt:{key:'ada',label:'Adaptação com Ada',cost:5}
  };
  /* Logos: FINEP e EMBRAPII via Wikimedia Commons; FUNCAP via site oficial (ce.gov.br).
     Demais órgãos: tentativa + fallback automático com a sigla. */
  var OPPS=[
    {id:'finep',abbr:'FINEP',logoUrl:'https://commons.wikimedia.org/wiki/Special:FilePath/Finep_logo.webp',
      cat:'Subvenção Econômica',fcat:'subvencao',
      nome:'FINEP Mais Inovação — Energias Renováveis 2026',
      fonte:'FINEP — Financiadora de Estudos e Projetos (Governo Federal)',
      temas:['Energia solar','Armazenamento','Redes inteligentes'],
      valor:'até R$ 3,2 mi',contrapartida:'mín. 20%',execucao:'24 meses',
      inscricao:'28 jul 2026',dias:25,
      objetivo:'Apoiar projetos de PD&I em geração distribuída, armazenamento de energia e gestão inteligente de redes, com foco em soluções escaláveis para a transição energética brasileira.',
      publico:'PMEs de base tecnológica do setor de energia, com CNPJ ativo há pelo menos 24 meses.',
      requisitos:['Empresa brasileira com sede e CNPJ ativos há 24+ meses','Receita operacional bruta entre R$ 500 mil e R$ 90 mi (ano-base 2025)','Projeto de inovação com TRL 4 a 7','Equipe técnica dedicada com ao menos 1 mestre ou doutor','Regularidade fiscal e trabalhista (CND, FGTS, CNDT)'],
      cronograma:[{d:'02 jun 2026',t:'Publicação do edital',s:'done'},{d:'28 jul 2026',t:'Encerramento das inscrições',s:'next'},{d:'15 set 2026',t:'Divulgação do resultado preliminar',s:''},{d:'30 set 2026',t:'Prazo para recursos',s:''},{d:'nov 2026',t:'Contratação e liberação da 1ª parcela',s:''}],
      link:'finep.gov.br/chamadas-publicas',
      matches:[{p:'p1',pct:92},{p:'p2',pct:74},{p:'p3',pct:41}]},
    {id:'embrapii',abbr:'EMBRAPII',logoUrl:'https://commons.wikimedia.org/wiki/Special:FilePath/EMBRAPII_Logo.svg',
      cat:'Projeto Cooperativo',fcat:'cooperativo',
      nome:'EMBRAPII — Chamada Transição Energética',
      fonte:'EMBRAPII — Empresa Brasileira de Pesquisa e Inovação Industrial',
      temas:['Transição energética','IoT industrial','Eficiência'],
      valor:'até R$ 1,8 mi',contrapartida:'33%',execucao:'18 meses',
      inscricao:'13 ago 2026',dias:41,
      objetivo:'Financiar projetos cooperativos entre empresas e Unidades EMBRAPII para desenvolvimento de tecnologias de transição energética, no modelo 1/3 EMBRAPII + 1/3 empresa + 1/3 unidade credenciada.',
      publico:'Empresas industriais e de base tecnológica dispostas a desenvolver em parceria com ICT credenciada.',
      requisitos:['Disposição para projeto cooperativo com Unidade EMBRAPII','Contrapartida financeira de 1/3 do valor do projeto','Desafio tecnológico com risco de PD&I demonstrável','Capacidade de absorção da tecnologia desenvolvida'],
      cronograma:[{d:'15 mai 2026',t:'Abertura da chamada',s:'done'},{d:'13 ago 2026',t:'Encerramento das inscrições',s:'next'},{d:'out 2026',t:'Seleção e negociação com Unidades',s:''},{d:'dez 2026',t:'Início dos projetos contratados',s:''}],
      link:'embrapii.org.br/chamadas',
      matches:[{p:'p1',pct:86},{p:'p3',pct:63}]},
    {id:'funcap',abbr:'FUNCAP',logoUrl:'https://www.ce.gov.br/funcap/wp-content/uploads/sites/92/2015/07/funcap.png',
      cat:'Subvenção Estadual',fcat:'subvencao',
      nome:'FUNCAP — Inovafit Fase 2 (Ceará)',
      fonte:'FUNCAP — Fundação Cearense de Apoio ao Desenvolvimento Científico e Tecnológico',
      temas:['Energia','IoT','Inovação regional'],
      valor:'até R$ 500 mil',contrapartida:'não exigida',execucao:'12 meses',
      inscricao:'15 jul 2026',dias:12,
      objetivo:'Subvencionar a validação e escalonamento de tecnologias inovadoras desenvolvidas por empresas cearenses que concluíram a Fase 1 ou demonstrem maturidade equivalente (TRL 5+).',
      publico:'Micro e pequenas empresas inovadoras com sede no Ceará.',
      requisitos:['Sede e operação no estado do Ceará','Enquadramento como micro ou pequena empresa','Tecnologia em TRL 5 ou superior','Coordenador com dedicação mínima de 20h/semana'],
      cronograma:[{d:'01 jun 2026',t:'Lançamento do edital',s:'done'},{d:'15 jul 2026',t:'Encerramento das inscrições',s:'next'},{d:'ago 2026',t:'Avaliação e diligências',s:''},{d:'set 2026',t:'Resultado final e contratação',s:''}],
      link:'funcap.ce.gov.br/editais',
      matches:[{p:'p2',pct:78},{p:'p1',pct:52}]},
    {id:'cnpq',abbr:'CNPq',logoUrl:'https://commons.wikimedia.org/wiki/Special:FilePath/CNPq.svg',
      cat:'Auxílio à Pesquisa',fcat:'subvencao',
      nome:'CNPq — Chamada Universal 2026',
      fonte:'CNPq — Conselho Nacional de Desenvolvimento Científico e Tecnológico',
      temas:['PD&I','Parceria com ICT','Bolsas'],
      valor:'até R$ 240 mil',contrapartida:'não exigida',execucao:'36 meses',
      inscricao:'30 set 2026',dias:89,
      objetivo:'Apoiar projetos de pesquisa científica, tecnológica e de inovação em todas as áreas do conhecimento, executados em parceria com pesquisadores vinculados a ICTs.',
      publico:'Pesquisadores doutores vinculados a ICTs; empresas participam como parceiras/executoras.',
      requisitos:['Coordenador com título de doutor e vínculo com ICT','Projeto executado em parceria academia-empresa','Currículo Lattes atualizado da equipe','Duração máxima de 36 meses'],
      cronograma:[{d:'10 jun 2026',t:'Publicação da chamada',s:'done'},{d:'30 set 2026',t:'Encerramento das inscrições',s:'next'},{d:'dez 2026',t:'Resultado preliminar',s:''},{d:'fev 2027',t:'Contratação',s:''}],
      link:'cnpq.br/chamadas-publicas',
      matches:[{p:'p3',pct:61},{p:'p1',pct:44}]},
    {id:'senai',abbr:'SENAI',logoUrl:'https://commons.wikimedia.org/wiki/Special:FilePath/Senai_logo.svg',
      cat:'Projeto Cooperativo',fcat:'cooperativo',
      nome:'SENAI — Edital de Inovação para a Indústria 2026',
      fonte:'SENAI / SESI — Serviço Nacional de Aprendizagem Industrial',
      temas:['Indústria 4.0','IoT','Eficiência energética'],
      valor:'até R$ 600 mil',contrapartida:'50%',execucao:'18 meses',
      inscricao:'20 ago 2026',dias:48,
      objetivo:'Desenvolver soluções inovadoras para a indústria brasileira em parceria com Institutos SENAI de Inovação e Tecnologia, com recursos econômicos e apoio técnico.',
      publico:'Indústrias e startups com solução aplicável ao setor industrial.',
      requisitos:['Projeto em parceria com Instituto SENAI','Contrapartida financeira ou econômica de 50%','Aplicabilidade industrial demonstrável','Empresa com CNPJ industrial ou startup de base tecnológica'],
      cronograma:[{d:'01 jul 2026',t:'Abertura das inscrições',s:'done'},{d:'20 ago 2026',t:'Encerramento das inscrições',s:'next'},{d:'out 2026',t:'Pitch e seleção final',s:''},{d:'nov 2026',t:'Contratação dos projetos',s:''}],
      link:'plataformainovacao.senai.br',
      matches:[{p:'p2',pct:71},{p:'p1',pct:58}]},
    {id:'bndes',abbr:'BNDES',logoUrl:'https://commons.wikimedia.org/wiki/Special:FilePath/BNDES_logo.svg',
      cat:'Subvenção Econômica',fcat:'subvencao',
      nome:'BNDES — Fundo Clima: Inovação Verde',
      fonte:'BNDES — Banco Nacional de Desenvolvimento Econômico e Social',
      temas:['Descarbonização','Hidrogênio','Energia limpa'],
      valor:'até R$ 5 mi',contrapartida:'25%',execucao:'30 meses',
      inscricao:'30 out 2026',dias:119,
      objetivo:'Apoiar com recursos não-reembolsáveis o desenvolvimento e escalonamento de tecnologias de descarbonização, energias limpas e hidrogênio de baixo carbono.',
      publico:'Empresas brasileiras de todos os portes com projetos de tecnologia climática (TRL 5+).',
      requisitos:['Projeto com impacto mensurável de redução de emissões','Tecnologia em TRL 5 ou superior','Contrapartida de 25% (financeira ou econômica)','Plano de escalonamento comercial'],
      cronograma:[{d:'20 jun 2026',t:'Abertura da chamada',s:'done'},{d:'30 out 2026',t:'Encerramento das inscrições',s:'next'},{d:'jan 2027',t:'Resultado da seleção',s:''},{d:'mar 2027',t:'Contratação',s:''}],
      link:'bndes.gov.br/fundoclima',
      matches:[{p:'p4',pct:67},{p:'p1',pct:64}]},
    {id:'aneel',abbr:'ANEEL',logoUrl:'https://commons.wikimedia.org/wiki/Special:FilePath/Aneel-logo.png',
      cat:'P&D Regulado',fcat:'cooperativo',
      nome:'ANEEL — Chamada de P&D Estratégico 2026',
      fonte:'ANEEL — Agência Nacional de Energia Elétrica',
      temas:['Redes inteligentes','Armazenamento','Geração distribuída'],
      valor:'até R$ 2,4 mi',contrapartida:'não exigida',execucao:'24 meses',
      inscricao:'05 set 2026',dias:60,
      objetivo:'Financiar projetos de P&D estratégico em geração distribuída, armazenamento e redes inteligentes, executados em parceria com distribuidoras de energia.',
      publico:'Empresas de base tecnológica com solução aplicável ao setor elétrico regulado.',
      requisitos:['Parceria com distribuidora de energia participante do programa','Projeto enquadrado nas prioridades estratégicas do ciclo','Equipe técnica com histórico em P&D setorial'],
      cronograma:[{d:'10 jun 2026',t:'Publicação da chamada',s:'done'},{d:'05 set 2026',t:'Encerramento das inscrições',s:'next'},{d:'nov 2026',t:'Seleção pelas distribuidoras',s:''},{d:'jan 2027',t:'Início dos projetos',s:''}],
      link:'aneel.gov.br/ped',
      matches:[]},
    {id:'sebrae',abbr:'SEBRAE',logoUrl:'https://commons.wikimedia.org/wiki/Special:FilePath/Sebrae_logo.png',
      cat:'Inovação Aberta',fcat:'subvencao',
      nome:'SEBRAE — Edital de Inovação Aberta para PMEs 2026',
      fonte:'SEBRAE — Serviço Brasileiro de Apoio às Micro e Pequenas Empresas',
      temas:['PMEs inovadoras','Escalonamento','Mercado'],
      valor:'até R$ 300 mil',contrapartida:'não exigida',execucao:'12 meses',
      inscricao:'22 ago 2026',dias:46,
      objetivo:'Apoiar pequenas empresas inovadoras na validação de mercado e no primeiro escalonamento comercial de novas tecnologias.',
      publico:'Micro e pequenas empresas com produto ou serviço inovador validado tecnicamente.',
      requisitos:['Enquadramento como micro ou pequena empresa','Tecnologia já validada tecnicamente (não é P&D básico)','Plano de escalonamento comercial em até 12 meses'],
      cronograma:[{d:'01 jul 2026',t:'Abertura do edital',s:'done'},{d:'22 ago 2026',t:'Encerramento das inscrições',s:'next'},{d:'out 2026',t:'Resultado final',s:''}],
      link:'sebrae.com.br/editais',
      matches:[]}
  ];
  var IRIS_COST=5;
  var saldo=47; /* demo: reseta a cada recarga */
  if(isZeroMode){
    /* Conta nova: zera projetos, jornada e o radar de matches — o usuário começa
       exatamente como um cliente real no dia 1, sem nenhum trabalho prévio. */
    PROJECTS={};
    JORNADA=[];
    OPPS.forEach(function(o){o.matches=[]});
    saldo=30; /* saldo de boas-vindas do plano Freemium, coerente com o texto de cadastro do login */
  }

  /* Contadores do menu lateral — sempre calculados a partir do dado real (nunca hardcoded), para que
     o modo conta nova (zero-state) mostre exatamente o que o usuário tem, sem número residual de demo.
     "Meus Agentes" não entra aqui de propósito: é o tamanho do time disponível (roster), não algo do
     usuário — continua igual em qualquer estado de conta. */
  function syncNavBadges(){
    var pt=$('#navProjTag');if(pt)pt.textContent=Object.keys(PROJECTS).length;
    var ot=$('#navOppTag');if(ot)ot.textContent=(typeof oppMatched==='function'?oppMatched().length:0);
    var dt=$('#navDocsTag');if(dt)dt.textContent=DOCS.length;
  }
  function syncSaldo(){
    $$('.saldo-view').forEach(function(el){el.textContent=saldo});
    var fill=$('#fichasBarFill');
    if(fill)fill.style.width=Math.min(100,Math.round(saldo/80*100))+'%';
    var chip=$('#fichasChip');
    if(chip){
      var low=saldo<10;
      chip.classList.toggle('low',low);
      chip.setAttribute('data-tip',low
        ?('Saldo baixo: não cobre a próxima ação recomendada (Ada · '+costPlainText('ada',20)+'). Clique para resolver.')
        :'Suas fichas: moeda de uso dos agentes. Clique para comprar.');
    }
  }

  /* ================= Saudação ================= */
  var h=new Date().getHours();
  var sauda=h<5?'Boa madrugada':h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  $('#greeting').childNodes[0].nodeValue=sauda+', ';

  /* ================= Próxima ação recomendada (v29) =================
     Escolhe o par projeto × edital mais relevante do momento e renderiza a
     recomendação do motor. Só UM cartão: a Home antiga abria até três banners
     concorrentes e o usuário tinha de decidir qual olhar primeiro — decisão que
     é justamente o que a plataforma deveria tomar por ele. */

  /* Prioriza por prazo: entre dois projetos que precisam de atenção, o que tem
     edital fechando antes ganha o destaque. Sem prazo, mantém a ordem natural. */
  function escolherFoco(){
    var cands=[];
    Object.keys(PROJECTS).forEach(function(pid){
      if(PROJECTS[pid].stage==='submitted')return;
      /* Melhor oportunidade deste projeto = a de maior aderência entre as que
         ainda estão abertas. É o edital que o usuário de fato perseguiria. */
      var melhor=null;
      OPPS.forEach(function(o){
        (o.matches||[]).forEach(function(m){
          if(m.p!==pid)return;
          if(!melhor||m.pct>melhor.pct)melhor={opp:o,pct:m.pct};
        });
      });
      cands.push({pid:pid,opp:melhor?melhor.opp:null,dias:melhor?melhor.opp.dias:null});
    });
    if(!cands.length)return null;
    cands.sort(function(a,b){
      if(a.dias==null)return 1; if(b.dias==null)return -1;
      return a.dias-b.dias;
    });
    return cands[0];
  }

  function renderNextBest(){
    var box=$('#nbaCard'); if(!box)return;
    var foco=escolherFoco();
    if(!foco){box.hidden=true;return}
    var rec=nextBestAction(foco.pid,foco.opp?foco.opp.id:null);
    if(!rec){box.hidden=true;return}
    var proj=PROJECTS[foco.pid];

    /* Estado "sem ação pendente": nunca inventa uma tarefa só para preencher a
       tela. Um SO que fabrica urgência perde a confiança que ele existe para ganhar. */
    if(!rec.agent){
      box.className='nba nba-idle';box.hidden=false;box.removeAttribute('style');
      box.innerHTML='<svg class="nba-av" aria-hidden="true"><use href="#monyu-symbol"/></svg>'+
        '<div class="nba-body"><div class="nba-tag">'+rec.tag+'</div>'+
        '<p class="nba-why" id="nbaTitle">'+rec.why+'</p></div>';
      return;
    }

    var custo=applyPromo(rec.agent,rec.costNum);
    var custoFinal=custo.final!==undefined?custo.final:rec.costNum;
    var sobra=saldo-custoFinal;
    var nome=(AGD.filter(function(a){return a.k===rec.agent})[0]||{}).name||rec.agent;
    var emDesenvolvimento=(AGD.filter(function(a){return a.k===rec.agent})[0]||{}).soon;

    box.className='nba';box.hidden=false;
    box.style.setProperty('--ac','var(--c-'+rec.agent+')');
    box.innerHTML=
      '<svg class="nba-av" aria-hidden="true"><use href="'+avatarHref(rec.agent)+'"/></svg>'+
      '<div class="nba-body">'+
        '<div class="nba-tag">'+rec.tag+'</div>'+
        '<p class="nba-why" id="nbaTitle">'+rec.why+'</p>'+
        '<div class="nba-meta">'+
          '<span class="nba-agent"><b>'+nome+'</b></span>'+
          '<span>projeto: <b>'+proj.short+'</b></span>'+
          (foco.opp?'<span>prazo: <b>'+foco.opp.dias+' dias</b></span>':'')+
          '<span>custo: '+costBadgeHTML(rec.agent,rec.costNum)+'</span>'+
          /* Saldo depois da ação, sempre visível: o usuário decide sabendo o que
             sobra, não descobre depois de gastar. */
          '<span>seu saldo depois: <b>'+(sobra>=0?sobra+' fichas':'insuficiente')+'</b></span>'+
        '</div>'+
      '</div>'+
      '<div class="nba-actions">'+
        (emDesenvolvimento
          ? '<button class="btn-ghost" data-agkey="'+rec.agent+'">Conhecer o '+nome+'</button>'
          : (sobra>=0
              ? '<button class="btn-primary" data-agent="'+rec.agent+'" data-proj="'+foco.pid+'">Executar com '+nome+'</button>'
              : '<button class="btn-primary" data-resolve-saldo="'+custoFinal+'">Faltam '+Math.abs(sobra)+' fichas — resolver</button>'))+
        '<button class="nba-alt" data-nav="agentes">Ver outras opções</button>'+
      '</div>';
  }

  /* ================= Navegação entre views ================= */
  function showView(name){
    $$('.view').forEach(function(v){v.classList.toggle('active',v.id==='view-'+name)});
    $$('.nav-item[data-nav]').forEach(function(n){
      if(n.getAttribute('data-nav')===name)n.setAttribute('aria-current','page');
      else n.removeAttribute('aria-current');
    });
    if(name==='aprovacoes'&&typeof renderAprov==='function')renderAprov();
    if(name==='inicio'&&typeof renderHomeV29==='function')renderHomeV29();
    if(name==='rotinas'&&typeof renderRotinas==='function')renderRotinas();
    if(name==='atividade'&&typeof renderAtividade==='function')renderAtividade();
    if(name==='resultados'&&typeof renderResultados==='function')renderResultados();
    if(name==='rewards'&&typeof renderRewards==='function')renderRewards();
    /* Marca as oportunidades vistas só ao ENTRAR na tela (não no carregamento
       inicial da página, que já popula #oppsFull escondido por trás de outra
       view) — senão o selo "novo" nunca teria a chance de aparecer pra
       ninguém. renderOpps() já rodou no load com a lista antiga de vistos;
       só agora, na visita de verdade, a lista é atualizada pra próxima vez. */
    if(name==='radar'&&typeof oppMarkAllSeen==='function')oppMarkAllSeen();
    if(name==='trein'&&store.get('tr-cost-seen','')!=='1'){
      store.set('tr-cost-seen','1');
      var tcm=$('#trCostModal');if(tcm)setTimeout(function(){open(tcm)},350);
    }
    window.scrollTo({top:0,behavior:'auto'});
    closeSidebar();
  }
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-nav]');
    if(t){e.preventDefault();showView(t.getAttribute('data-nav'))}
  });

  /* ================= Tema ================= */
  var themeBtn=$('#themeBtn'),iconSun=$('#iconSun'),iconMoon=$('#iconMoon');
  function applyTheme(t){
    root.setAttribute('data-theme',t);
    iconSun.style.display=t==='dark'?'none':'block';
    iconMoon.style.display=t==='dark'?'block':'none';
    store.set('theme',t);
  }
  applyTheme(store.get('theme','dark'));
  themeBtn.addEventListener('click',function(){applyTheme(root.getAttribute('data-theme')==='dark'?'light':'dark')});

  /* ================= Painéis (a11y + notificações) ================= */
  function bindPanel(btnId,panelId){
    var btn=$('#'+btnId),pn=$('#'+panelId);
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      $$('.a11y-panel.open,.notif-panel.open').forEach(function(p){if(p!==pn)p.classList.remove('open')});
      var open=pn.classList.toggle('open');
      btn.setAttribute('aria-expanded',open);
    });
    document.addEventListener('click',function(e){
      if(pn.classList.contains('open')&&!pn.contains(e.target)&&!btn.contains(e.target)){
        pn.classList.remove('open');btn.setAttribute('aria-expanded','false');
      }
    });
    return pn;
  }
  var panel=bindPanel('a11yBtn','a11yPanel');
  var notifPanel=bindPanel('notifBtn','notifPanel');
  var urgentPanel=bindPanel('urgentChipBtn','urgentPanel');
  $('#notifClear').addEventListener('click',function(){
    $$('.notif-item').forEach(function(n){n.classList.add('read')});
    $('#notifDot').style.display='none';
    $('#notifBtn').setAttribute('aria-label','Abrir notificações (0 não lidas)');
    toast('Todas as notificações foram marcadas como lidas');
  });
  /* Itens de notificação levam pra tela relacionada (2026-08-06) — reaproveita
     os mesmos atributos [data-nav]/[data-ws] já delegados globalmente pro
     resto do app; só falta fechar o painel de notificações no clique, senão
     ele fica flutuando por cima da view nova (mesmo padrão já usado pros
     prazos urgentes, ver [data-urgent-jump] mais abaixo). */
  document.addEventListener('click',function(e){
    var ni=e.target.closest('#notifList .notif-item[data-nav],#notifList .notif-item[data-ws]');
    if(ni){
      notifPanel.classList.remove('open');
      $('#notifBtn').setAttribute('aria-expanded','false');
    }
  });
  var notifFichasLink=$('#notifFichasLink');
  if(notifFichasLink)notifFichasLink.addEventListener('click',function(){
    notifPanel.classList.remove('open');
    $('#notifBtn').setAttribute('aria-expanded','false');
    openPlans();
  });

  /* ================= Acessibilidade ================= */
  var fontVal=$('#fontVal'),scale=parseFloat(store.get('font','1'));
  function applyFont(s){
    scale=Math.min(1.3,Math.max(.85,Math.round(s*100)/100));
    root.style.setProperty('--font-scale',scale);
    fontVal.textContent=Math.round(scale*100)+'%';
    store.set('font',scale);
  }
  applyFont(scale);
  $('#fontUp').addEventListener('click',function(){applyFont(scale+0.1)});
  $('#fontDown').addEventListener('click',function(){applyFont(scale-0.1)});
  var swC=$('#swContrast'),swM=$('#swMotion');
  swC.checked=store.get('contrast','normal')==='high';
  swM.checked=store.get('motion','full')==='reduced';
  root.setAttribute('data-contrast',swC.checked?'high':'normal');
  root.setAttribute('data-motion',swM.checked?'reduced':'full');
  swC.addEventListener('change',function(){
    var v=swC.checked?'high':'normal';
    root.setAttribute('data-contrast',v);store.set('contrast',v);
    toast(swC.checked?'Alto contraste ativado':'Alto contraste desativado');
  });
  swM.addEventListener('change',function(){
    var v=swM.checked?'reduced':'full';
    root.setAttribute('data-motion',v);store.set('motion',v);
    toast(swM.checked?'Animações reduzidas':'Animações completas');
  });

  /* ================= Sidebar: 1 botão adaptativo (mobile = drawer · desktop >=901px = colapsar) ================= */
  var sidebar=$('#sidebar'),scrim=$('#scrim'),menuBtn=$('#menuBtn'),appEl=$('.app');
  var menuIconClose=$('#menuIconClose'),menuIconOpen=$('#menuIconOpen');
  function isDesktopSidebar(){return typeof window.matchMedia==='function'?window.matchMedia('(min-width:901px)').matches:window.innerWidth>900}

  function closeSidebar(){ // fecha o drawer mobile (chamado ao navegar, Escape etc.)
    sidebar.classList.remove('open');
    scrim.classList.remove('show');
    syncMenuBtn();
  }
  function setSidebarCollapsed(v){ // colapsa/expande a sidebar fixa do desktop
    appEl.classList.toggle('sidebar-collapsed',v);
    store.set('sidebarCollapsed',v?'1':'0');
    syncMenuBtn();
  }
  function syncMenuBtn(){
    var hidden=isDesktopSidebar()?appEl.classList.contains('sidebar-collapsed'):!sidebar.classList.contains('open');
    if(menuIconClose)menuIconClose.style.display=hidden?'none':'block';
    if(menuIconOpen)menuIconOpen.style.display=hidden?'block':'none';
    menuBtn.setAttribute('aria-expanded',String(!hidden));
    menuBtn.setAttribute('aria-label',hidden?'Mostrar menu lateral':'Ocultar menu lateral');
  }
  menuBtn.addEventListener('click',function(){
    if(isDesktopSidebar()){
      setSidebarCollapsed(!appEl.classList.contains('sidebar-collapsed'));
    }else{
      var open=sidebar.classList.toggle('open');
      scrim.classList.toggle('show',open);
      syncMenuBtn();
    }
  });
  scrim.addEventListener('click',closeSidebar);
  function resetSidebarOnBreakpoint(){ // ao cruzar o breakpoint (redimensionar janela/girar celular), tira estados que não fazem sentido no outro modo
    sidebar.classList.remove('open');
    scrim.classList.remove('show');
    syncMenuBtn();
  }
  if(typeof window.matchMedia==='function'){
    var mqDesktop=window.matchMedia('(min-width:901px)');
    if(mqDesktop.addEventListener)mqDesktop.addEventListener('change',resetSidebarOnBreakpoint);
    else if(mqDesktop.addListener)mqDesktop.addListener(resetSidebarOnBreakpoint);
  }else{
    window.addEventListener('resize',resetSidebarOnBreakpoint);
  }
  setSidebarCollapsed(store.get('sidebarCollapsed','0')==='1');

  /* ================= Sidebar: chevron de recolher + logo vira botão de expandir ================= */
  var sidebarCollapseBtn=$('#sidebarCollapseBtn'),logoBtn=$('#logoBtn');
  if(sidebarCollapseBtn)sidebarCollapseBtn.addEventListener('click',function(){setSidebarCollapsed(true)});
  if(logoBtn)logoBtn.addEventListener('click',function(e){
    if(isDesktopSidebar()&&appEl.classList.contains('sidebar-collapsed')){
      e.preventDefault();e.stopPropagation();
      setSidebarCollapsed(false);
    }
  });

  /* ================= Perfil: flyout no rodapé da sidebar ================= */
  var profileBtn=$('#profileBtn'),profileFlyout=$('#profileFlyout');
  function closeProfileFlyout(){
    if(!profileFlyout)return;
    profileFlyout.classList.remove('open');
    if(profileBtn)profileBtn.setAttribute('aria-expanded','false');
  }
  if(profileBtn&&profileFlyout){
    profileBtn.addEventListener('click',function(e){
      e.stopPropagation();
      var open=profileFlyout.classList.toggle('open');
      profileBtn.setAttribute('aria-expanded',String(open));
    });
    document.addEventListener('click',function(e){
      if(profileFlyout.classList.contains('open')&&!e.target.closest('.profile-wrap'))closeProfileFlyout();
    });
    document.addEventListener('keydown',function(e){if(e.key==='Escape')closeProfileFlyout()});
  }

  /* ================= Toast ================= */
  var toastEl=$('#toast'),toastMsg=$('#toastMsg'),toastTimer;
  function toast(msg){
    toastMsg.textContent=msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){toastEl.classList.remove('show')},3400);
  }
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-toast]');
    if(t){if(t.tagName==='A')e.preventDefault();toast(t.getAttribute('data-toast'))}
  });

  /* Sair: único item do menu de perfil com efeito real no piloto (os demais
     — Perfil, Dados da empresa, Configurações — seguem "em breve", ver
     data-toast no HTML). Mesmo padrão de transição do login (toast curto +
     pequeno atraso antes de navegar), não um redirecionamento seco. */
  var logoutBtn=$('#logoutBtn');
  if(logoutBtn)logoutBtn.addEventListener('click',function(e){
    e.preventDefault();
    toast('Saindo…');
    setTimeout(function(){window.location.href='index.html'},600);
  });

  /* ================= Banner dispensável ================= */
  var banner=$('#heroAlert');
  if(store.get('banner-rico-3opp','')==='hidden')banner.classList.add('hidden');
  if(isZeroMode)banner.classList.add('hidden'); /* banner estático não se aplica a quem ainda não tem projeto */
  $('#bannerHide').addEventListener('click',function(){
    banner.classList.add('hidden');
    store.set('banner-rico-3opp','hidden');
    toast('Aviso ocultado. Você continua vendo as novidades no sino de notificações.');
  });

  /* ================= Campanha promocional: banner + chip do topbar + painel ================= */
  var promoPanel=bindPanel('promoChipBtn','promoPanel');
  function renderPromo(){
    var live=promoIsLive();
    var chipBtn=$('#promoChipBtn');
    if(chipBtn){
      chipBtn.style.display=live?'':'none';
      var chipTxt=$('#promoChipTxt');
      if(chipTxt)chipTxt.textContent='-'+PROMO.pct+'% · '+promoDaysLeft()+'d';
    }
    var pBody=$('#promoPanelBody');
    if(pBody){
      pBody.innerHTML=
        '<div class="promo-panel-row"><span>Campanha</span><b>'+PROMO.label+'</b></div>'+
        '<div class="promo-panel-row"><span>Desconto</span><b class="promo-final">-'+PROMO.pct+'%</b></div>'+
        '<div class="promo-panel-row"><span>Termina em</span><b>'+promoEndLabel()+' · '+promoDaysLeft()+' dia'+(promoDaysLeft()!==1?'s':'')+'</b></div>'+
        '<div class="promo-panel-row"><span>Agentes no escopo</span><b>'+promoScopeLabel()+'</b></div>';
    }
    var pBanner=$('#promoBanner');
    if(pBanner){
      var dismissed=store.get('banner-promo-'+PROMO.id,'')==='hidden';
      pBanner.classList.toggle('hidden',!live||dismissed);
      var sub=$('#promoBannerSub');
      if(sub)sub.textContent='Até '+promoEndLabel()+' — todos os agentes saem com '+PROMO.pct+'% de desconto em fichas. Aproveite para elaborar e diagnosticar seus projetos pagando metade do preço.';
    }
  }
  var promoBannerHide=$('#promoBannerHide');
  if(promoBannerHide)promoBannerHide.addEventListener('click',function(){
    $('#promoBanner').classList.add('hidden');
    store.set('banner-promo-'+PROMO.id,'hidden');
    toast('Aviso ocultado. Você ainda vê o desconto ativo no chip 🔥 do topo e em cada preço dos agentes.');
  });
  renderPromo();

  /* ================= Modais genéricos ================= */
  function open(m){m.classList.add('open')}
  function close(m){m.classList.remove('open')}
  $$('[data-close]').forEach(function(b){
    b.addEventListener('click',function(){close($('#'+b.getAttribute('data-close')))});
  });
  $$('.modal').forEach(function(m){
    m.addEventListener('click',function(e){if(e.target===m)close(m)});
  });

  /* ================= Selecionar tudo ao focar campo de linha única (v29) =================
     Pedido do usuário (2026-08-05): campos como "teto de fichas" ou "nome da
     rotina" são quase sempre SUBSTITUÍDOS por inteiro, não editados no meio —
     selecionar o conteúdo ao focar deixa reescrever num só gesto. Regra
     central via delegação (focusin borbulha, ao contrário de focus) para
     cobrir todo <input> de texto/número atual E futuro sem fiar campo por
     campo — só falta lembrar de NÃO aplicar em <textarea> (o pedido foi
     explícito) nem em tipos onde "selecionar tudo" não faz sentido
     (checkbox, radio, file, color, range...).
     Exceção deliberada: caixas de busca (oppSearch, kbSearch, cmdkInput,
     runProjFilter) ficam de fora por enquanto — ali o padrão comum é refinar
     só uma palavra da busca anterior, não substituir tudo. Reavaliar se o
     usuário pedir depois. */
  var SELALL_TIPOS_EXCLUIDOS=['checkbox','radio','range','color','file','date','month',
    'week','time','datetime-local','submit','button','reset','image','hidden'];
  var SELALL_IDS_EXCLUIDOS=['oppSearch','kbSearch','cmdkInput','runProjFilter'];
  function selAllElegivel(el){
    return el&&el.tagName==='INPUT'&&SELALL_TIPOS_EXCLUIDOS.indexOf(el.type)===-1&&
      SELALL_IDS_EXCLUIDOS.indexOf(el.id)===-1&&!el.readOnly&&!el.disabled;
  }
  /* O clique real revela um problema que .focus() programático não mostra em
     teste automatizado: mousedown -> focusin (aqui chamamos select()) ->
     mouseup, e o mouseup de um clique DE MOUSE reposiciona o cursor onde o
     dedo/ponteiro soltou, desfazendo a seleção que acabou de ser feita. Por
     isso guardamos, no mousedown, se o campo JÁ estava focado antes deste
     clique: só suprimimos o reposicionamento do mouseup quando este clique
     foi o que originou o foco — assim clicar de novo num campo já focado
     continua posicionando o cursor normalmente (não trava a edição normal).
     Foco por Tab (sem mouse) não passa por aqui e funciona sem ajuste extra. */
  var selAllOrigemFoco=null;
  document.addEventListener('mousedown',function(e){
    if(!selAllElegivel(e.target))return;
    selAllOrigemFoco=(e.target!==document.activeElement);
  });
  document.addEventListener('focusin',function(e){
    if(!selAllElegivel(e.target))return;
    e.target.select();
  });
  document.addEventListener('mouseup',function(e){
    if(!selAllElegivel(e.target))return;
    if(selAllOrigemFoco){e.preventDefault();selAllOrigemFoco=null}
  });

  /* ================= Execução de agente ================= */
  /* Drawer, não modal (v29) — mesmo padrão do drawer de agente/projeto. openRunDrawer/
     closeRunDrawer somam o scrim ao open()/close() genéricos, que só tratam a classe
     .open do próprio painel. */
  var runModal=$('#runModal'),runScrim=$('#runScrim'),pendAgent='',pendKey='';
  var pendingRunAgent=null;
  function openRunDrawer(){open(runModal);runScrim.classList.add('show')}
  function closeRunDrawer(){close(runModal);runScrim.classList.remove('show')}
  runScrim.addEventListener('click',closeRunDrawer);
  $('#runClose').addEventListener('click',closeRunDrawer);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&runModal.classList.contains('open'))closeRunDrawer()});
  var WEB_ON={rico:true,iris:true,ada:true,aurora:true,kai:true,mike:true};
  function projDocsCount(pid){var n=0;DOCS.forEach(function(d){if(d.proj===pid)n++});return n}
  function globalDocsCount(){var n=0;DOCS.forEach(function(d){if(!d.proj)n++});return n}
  function runSourcesText(key,ids){
    var docs=globalDocsCount();
    ids.forEach(function(pid){docs+=projDocsCount(pid)});
    var extra=(key==='rico'&&ids.length>1)?' · lote de '+ids.length+' projetos (até 5 por rodada)':'';
    return 'Núcleo MonyU + Memória ('+docs+' docs)'+extra+(WEB_ON[key]===false?' · <span style="color:var(--warn-text)">web desativada</span>':' + Web');
  }
  /* Regra de precificação por volume (aprovada 2026-07-08):
     Rico tem preço de lote (1 projeto = 1 ficha; 2–5 projetos = 3 fichas, tarifa única de lote).
     Todos os demais agentes cobram o preço unitário do agente multiplicado pela quantidade de projetos selecionados. */
  function agentUnitRange(key){
    var c=String(AG[key].cost);
    if(c.indexOf('–')>-1){var parts=c.split('–');return [parseInt(parts[0],10),parseInt(parts[1],10)]}
    var n=parseInt(c,10)||0;return [n,n];
  }
  function computeCostRange(key,ids){
    var n=ids.length;
    if(n===0)return null;
    if(key==='rico')return n===1?[1,1]:[3,3];
    var u=agentUnitRange(key);
    return [u[0]*n,u[1]*n];
  }
  function rangeLabel(r){
    if(!r)return '—';
    return (r[0]===r[1]?String(r[0]):(r[0]+'–'+r[1]))+' ficha'+(r[1]>1?'s':'');
  }
  function runPromoNote(key){
    if(!promoAppliesTo(key))return '';
    return ' <span class="promo-note">🔥 Campanha '+PROMO.label+': -'+PROMO.pct+'% aplicado a este agente até '+promoEndLabel()+'.</span>';
  }
  /* Legenda curta sob o preço — não uma regra explicada por extenso. O preço já
     mostra o total ao vivo conforme o usuário marca projetos; a legenda só precisa
     dizer a unidade (e, no caso do Rico, o motivo do preço não ser linear). */
  function runPricingNote(key,n){
    if(key==='rico'){
      var txt='Lote: 1 projeto = 1 ficha · 2 a 5 projetos = 3 fichas (preço fixo, não por unidade).';
      return txt+runPromoNote(key);
    }
    var u=agentUnitRange(key);
    var unitTxt=u[0]===u[1]?(u[0]+' fichas'):(u[0]+'–'+u[1]+' fichas');
    return unitTxt+' por projeto selecionado.'+runPromoNote(key);
  }
  function runProjItems(key,ctxProj){
    var pids=Object.keys(PROJECTS);
    var html='';
    /* Busca só entra com muitos projetos — com poucos (o caso comum) é ruído
       antes da lista, sem servir pra nada. */
    if(pids.length>5)html+='<input type="text" id="runProjFilter" class="run-proj-filter" placeholder="Buscar projeto…" autocomplete="off">';
    html+='<div class="run-proj-items">';
    pids.forEach(function(pid){
      var p=PROJECTS[pid];
      html+='<label class="run-proj-item" data-pname="'+p.name.toLowerCase()+'"><input type="checkbox" data-runp="'+pid+'"'+(ctxProj===pid?' checked':'')+'><span class="rpi-name">'+p.name+'</span>'+(p.complete?'<span class="rpi-tag">✓ 100% elaborado</span>':'')+'</label>';
    });
    html+='</div>';
    if(pids.length>1)html+='<button type="button" class="run-proj-selall" id="runProjSelAll">Selecionar todos</button>';
    html+='<button type="button" class="run-proj-new" id="runProjNew">+ Cadastrar novo projeto…</button>';
    return html;
  }
  function selectedIds(){
    return Array.prototype.slice.call(runModal.querySelectorAll('[data-runp]:checked')).map(function(cb){return cb.getAttribute('data-runp')});
  }
  function updateRunState(){
    var ids=selectedIds();
    var range=computeCostRange(pendKey,ids); /* faixa base, sem desconto */
    $('#runPricingNote').innerHTML=runPricingNote(pendKey,ids.length);
    $('#runCost').innerHTML=range?rangeLabelPromo(pendKey,range):'—';
    $('#runSources').innerHTML=runSourcesText(pendKey,ids);
    var rc=$('#runConfirm');
    if(ids.length===0){
      rc.disabled=true;rc.removeAttribute('data-buy');
      $('#runAfter').textContent='—';
      rc.textContent='Selecione ao menos 1 projeto';
      return;
    }
    /* cost/finalRange = valor REAL que será debitado (já com o desconto da campanha, se houver) */
    var finalRange=[applyPromo(pendKey,range[0]).final,applyPromo(pendKey,range[1]).final];
    var cost=finalRange[1];
    $('#runAfter').textContent=finalRange[0]===finalRange[1]?Math.max(0,saldo-cost):(Math.max(0,saldo-finalRange[1]))+'–'+(Math.max(0,saldo-finalRange[0]));
    rc.disabled=false;
    if(cost>saldo){
      var g=cost-saldo;
      rc.setAttribute('data-buy',g);
      rc.textContent='Falta'+(g>1?'m':'')+' '+g+' ficha'+(g>1?'s':'')+' — resolver agora';
    }else{rc.removeAttribute('data-buy');rc.textContent='Confirmar e executar · '+rangeLabel(finalRange)+(promoAppliesTo(pendKey)?' (-'+PROMO.pct+'%)':'')}
  }
  function wireRunProjEvents(){
    runModal.querySelectorAll('[data-runp]').forEach(function(cb){
      cb.addEventListener('change',updateRunState);
    });
    var filterInput=$('#runProjFilter');
    if(filterInput)filterInput.addEventListener('input',function(){
      var q=filterInput.value.trim().toLowerCase();
      runModal.querySelectorAll('.run-proj-item').forEach(function(item){
        var name=item.getAttribute('data-pname')||'';
        item.style.display=(!q||name.indexOf(q)>-1)?'':'none';
      });
    });
    var selAll=$('#runProjSelAll');
    if(selAll)selAll.addEventListener('click',function(){
      var boxes=runModal.querySelectorAll('[data-runp]');
      var allOn=Array.prototype.every.call(boxes,function(cb){return cb.checked});
      boxes.forEach(function(cb){cb.checked=!allOn});
      selAll.textContent=allOn?'Selecionar todos':'Limpar seleção';
      updateRunState();
    });
    var newBtn=$('#runProjNew');
    if(newBtn)newBtn.addEventListener('click',function(){
      pendingRunAgent=pendKey;closeRunDrawer();open($('#newProjModal'));
    });
  }
  function openRun(key,ctxProj){
    var a=AG[key];if(!a)return;
    pendAgent=a.name;pendKey=key;
    $('#runAgent').textContent=a.name;
    $('#runAvatar').querySelector('use').setAttribute('href','#av-'+key);
    $('#runDesc').textContent=a.desc;
    $('#runSaldo').textContent=saldo;
    $('#runProjList').innerHTML=runProjItems(key,ctxProj);
    wireRunProjEvents();
    updateRunState();
    openRunDrawer();
    $('#runConfirm').focus();
  }
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-agent]');
    if(t&&!t.disabled){openRun(t.getAttribute('data-agent'),t.getAttribute('data-proj')||'')}
  });
  $('#runCancel').addEventListener('click',function(){pendOppMatch=null;closeRunDrawer()});
  $('#runConfirm').addEventListener('click',function(){
    var ids=selectedIds();
    if(ids.length===0)return;
    var buyGap=this.getAttribute('data-buy');
    if(buyGap){resolverSaldo(parseInt(buyGap,10),null,function(){openRun(pendKey,ids.length===1?ids[0]:'')});return}
    var range=computeCostRange(pendKey,ids),cost=applyPromo(pendKey,range[1]).final; /* valor REAL debitado, já com desconto */
    var pname=ids.length===1?PROJECTS[ids[0]].name:(ids.length+' projetos selecionados');
    saldo=Math.max(0,saldo-cost);
    syncSaldo();
    closeRunDrawer();
    /* Recompensas: XP por qualquer execução + selos por primeira vez em cada agente */
    if(typeof rwAddXp==='function'){
      rwAddXp(5);
      if(pendKey==='rico'||pendKey==='iris'||pendKey==='aurora'||pendKey==='mike'||pendKey==='kai'){
        rwCntInc(pendKey);
      }else if(pendKey==='ada'){
        if(ids.length===1&&PROJECTS[ids[0]].complete)rwCntInc('reengage');
        else rwCntInc('adaprojects');
      }
      if(typeof rwRecalcAll==='function')rwRecalcAll();
    }
    if(pendKey==='rico')resolvePendingOppMatch(ids);
    if(pendKey==='rico'&&isZeroMode)ensureSyntheticMatches(ids);
    if(pendKey==='rico')syncNavBadges(); /* nº de Oportunidades no menu = matches reais, muda a cada scan do Rico */
    startTask(pendKey,AG[pendKey].name+' — '+AGLABEL[pendKey]+' · '+pname.substring(0,36)+(pname.length>36?'…':''),AG[pendKey].name+' concluiu: '+AGLABEL[pendKey]+' ('+pname.substring(0,26)+(pname.length>26?'…':'')+')',8000+Math.random()*6000);
    var promoNoteTxt=promoAppliesTo(pendKey)?(' · desconto de campanha aplicado (-'+PROMO.pct+'%)'):'';
    toast(pendAgent+' começou a trabalhar para "'+pname+'" — acompanhe no canto da tela.'+promoNoteTxt+' (demo)');
  });

  /* ================= Logos com fallback ================= */
  window.logoFail=function(img){
    var abbr=img.getAttribute('data-abbr')||'?';
    var span=document.createElement('span');
    span.textContent=abbr;
    span.style.cssText='font-weight:800;font-size:.71rem;color:#333;letter-spacing:.02em';
    img.replaceWith(span);
  };
  function logoImg(o){
    return '<img src="'+o.logoUrl+'" alt="Logo '+o.abbr+'" loading="lazy" data-abbr="'+o.abbr+'" onerror="logoFail(this)">';
  }

  /* ================= Cards de oportunidade ================= */
  /* A recomendação por projeto×oportunidade usa o motor completo (nextBestAction),
     não mais o recommendedAgent() genérico por projeto. Diferença real: um edital
     com contrapartida de 20%+ ou exigência de parceria puxa Bartô/Eros antes da
     Ada — é exatamente o cenário que este radar existe para mostrar (v29). */
  function oppRecHTML(pid,oppId){
    var rec=nextBestAction(pid,oppId);
    if(!rec||!rec.agent)return '';
    /* nextBestAction pode recomendar qualquer um dos 14 (ex.: Bartô, Eros) — o
       objeto AG só cobre os 6 do drawer de execução. O nome vem do catálogo
       completo, igual ao nbaCard da Home. */
    var nome=(AGD.filter(function(a){return a.k===rec.agent})[0]||{}).name||rec.agent;
    return nome+' · '+costBadgeHTML(rec.agent,rec.costNum);
  }
  function oppMatchRow(m,o){
    var p=PROJECTS[m.p];
    var recHtml=oppRecHTML(m.p,o.id);
    return '<span class="omr"><b>'+(p?p.short:m.p)+'</b><span class="omr-pct">'+m.pct+'%</span>'+
      (recHtml?'<span class="omr-rec">→ '+recHtml+'</span>':'')+'</span>';
  }
  function oppMatchSummary(o){
    var sorted=o.matches.slice().sort(function(a,b){return b.pct-a.pct});
    var top=sorted.slice(0,3),rest=sorted.length-top.length;
    return '<span class="opp-match-list">'+top.map(function(m){return oppMatchRow(m,o)}).join('')+
      (rest>0?'<span class="omr-more">+'+rest+' outro'+(rest>1?'s':'')+' projeto'+(rest>1?'s':'')+' com match</span>':'')+
    '</span>';
  }
  /* ================= Novidade de oportunidades desde a última visita =================
     Sem data de descoberta por oportunidade nos dados do piloto — a marca de "visto" é
     por ID, salva no primeiro carregamento da tela. Na primeiríssima visita (nada salvo
     ainda), semeamos como "já visto" tudo MENOS as 3 do último scan do Rico (mesmas 3 já
     citadas na Home e na Atividade: "Rico encontrou 3 oportunidades novas — a melhor com
     92%"), pra a primeira experiência do piloto já nascer coerente com esse texto em vez
     de mostrar as 8 como novas de uma vez (o que não ensinaria nada sobre o recurso). */
  var OPP_SCAN_MAIS_RECENTE=['finep','embrapii','funcap'];
  function oppSeenIds(){
    var raw=store.get('oppsSeen',null);
    if(raw===null){
      var seeded=OPPS.filter(function(o){return OPP_SCAN_MAIS_RECENTE.indexOf(o.id)===-1}).map(function(o){return o.id});
      store.set('oppsSeen',JSON.stringify(seeded));
      return seeded;
    }
    try{return JSON.parse(raw)}catch(e){return []}
  }
  function oppMarkAllSeen(){
    store.set('oppsSeen',JSON.stringify(OPPS.map(function(o){return o.id})));
  }
  function oppCard(o,idx,isNew){
    var best=o.matches.reduce(function(a,b){return b.pct>a.pct?b:a});
    var circ=131.9;
    return '<button class="opp'+(isNew?' opp-is-new':'')+'" data-opp="'+o.id+'" data-fcat="'+o.fcat+'" data-dias="'+o.dias+'" style="animation:rise .5s var(--ease) '+(0.05+idx*0.05)+'s backwards" aria-label="Abrir detalhes de '+o.nome+(isNew?' — nova desde sua última visita':'')+'">'+
      (isNew?'<span class="opp-new-badge">novo</span>':'')+
      '<span class="opp-top">'+
        '<span class="opp-logo">'+logoImg(o)+'</span>'+
        '<span class="match-badge"><span class="match"><svg viewBox="0 0 52 52">'+
          '<circle class="track" cx="26" cy="26" r="21" fill="none" stroke-width="5"/>'+
          '<circle class="val" cx="26" cy="26" r="21" fill="none" stroke-width="5" stroke-dasharray="'+circ+'" stroke-dashoffset="'+circ+'" data-pct="'+best.pct+'" transform="rotate(-90 26 26)"/>'+
          '<text x="26" y="30" text-anchor="middle">'+best.pct+'%</text></svg></span>'+
        '<small>melhor match</small></span>'+
      '</span>'+
      '<span class="opp-cat">'+o.cat+'</span>'+
      '<h3>'+o.nome+'</h3>'+
      '<span class="opp-fonte">'+o.fonte.split('—')[0].trim()+'</span>'+
      '<span class="opp-tags">'+o.temas.map(function(t){return '<span class="opp-tag thema">'+t+'</span>'}).join('')+'</span>'+
      '<span class="opp-foot">'+
        '<span class="opp-val">'+o.valor+'<small>contrapartida '+o.contrapartida+'</small></span>'+
        '<span class="opp-deadline">⏱ '+o.dias+' dias</span>'+
      '</span>'+
      oppMatchSummary(o)+
    '</button>';
  }
  function oppCardUnmatched(o,idx,isNew){
    return '<div class="opp opp-unmatched'+(isNew?' opp-is-new':'')+'" data-opp="'+o.id+'" data-fcat="'+o.fcat+'" data-dias="'+o.dias+'" style="animation:rise .5s var(--ease) '+(0.05+idx*0.05)+'s backwards">'+
      (isNew?'<span class="opp-new-badge">novo</span>':'')+
      '<span class="opp-top">'+
        '<span class="opp-logo">'+logoImg(o)+'</span>'+
        '<span class="nomatch-badge">sem matching ainda</span>'+
      '</span>'+
      '<span class="opp-cat">'+o.cat+'</span>'+
      '<h3>'+o.nome+'</h3>'+
      '<span class="opp-fonte">'+o.fonte.split('—')[0].trim()+'</span>'+
      '<span class="opp-tags">'+o.temas.map(function(t){return '<span class="opp-tag thema">'+t+'</span>'}).join('')+'</span>'+
      '<span class="opp-foot">'+
        '<span class="opp-val">'+o.valor+'<small>contrapartida '+o.contrapartida+'</small></span>'+
        '<span class="opp-deadline">⏱ '+o.dias+' dias</span>'+
      '</span>'+
      '<button class="btn-ghost opp-match-btn" data-oppmatch="'+o.id+'" style="width:100%;font-size:.76rem;margin-top:.3rem">Rodar matching com Rico</button>'+
    '</div>';
  }
  function oppMatched(){return OPPS.filter(function(o){return o.matches.length>0})}
  function oppUnmatched(){return OPPS.filter(function(o){return o.matches.length===0})}
  var oppFilter='todas';
  function renderOpps(){
    /* "novo" é calculado com a lista de vistos de ANTES desta renderização —
       só depois de montar o HTML (com o selo ainda valendo) é que marcamos
       tudo como visto, pra próxima visita não repetir o selo à toa. */
    var seenBefore=oppSeenIds();
    function isNewOpp(o){return seenBefore.indexOf(o.id)===-1}
    var mh=oppMatched();
    $('#oppsHome').innerHTML=mh.length?mh.slice(0,3).map(function(o,i){return oppCard(o,i,isNewOpp(o))}).join('')
      :'<p style="font-size:.82rem;color:var(--text-3);padding:.4rem 0">Nenhum match ainda — rode o Rico para cruzar seus projetos com os editais abertos.</p>';
    $('#oppsFull').innerHTML=oppMatched().map(function(o,i){return oppCard(o,i,isNewOpp(o))}).join('');
    var um=oppUnmatched();
    var umSection=$('#oppsUnmatchedSection');
    if(umSection)umSection.style.display=um.length?'':'none';
    $('#oppsUnmatched').innerHTML=um.map(function(o,i){return oppCardUnmatched(o,i,isNewOpp(o))}).join('');
    var cnt=$('#oppsTotalCount');if(cnt)cnt.textContent=OPPS.length;
    applyOppFilters();
  }
  /* Chamada mais abaixo (perto de renderNextBest), não aqui: os cards de
     oportunidade agora usam nextBestAction(), que depende de AGD — e AGD só é
     definido bem mais adiante no arquivo. Chamar renderOpps() aqui rodava antes
     de AGD existir e quebrava com "Cannot read properties of undefined". */
  renderJornada();

  /* ================= Início: estado vazio (conta nova) ================= */
  function renderInicioZero(){
    var hasProj=Object.keys(PROJECTS).length>0;
    var wrap=$('#inicioProjectsWrap'),empty=$('#inicioProjectsEmpty');
    if(isZeroMode){
      /* Os 3 cards de "Projetos em andamento" são HTML estático da demo populada — não
         existe card dinâmico equivalente pra espelhar aqui, então em conta nova esse bloco
         fica sempre oculto (mesmo depois de o cliente cadastrar 1 projeto) e o espaço vira
         um status simples com CTA pra "Meus projetos", onde o card real já aparece. */
      if(wrap)wrap.style.display='none';
      if(empty){
        empty.style.display='';
        empty.innerHTML=hasProj
          ?('<p style="font-size:.86rem;color:var(--text-3);margin-bottom:1rem">Seu projeto <b style="color:var(--text)">"'+PROJECTS[Object.keys(PROJECTS)[0]].name+'"</b> está cadastrado. Continue a jornada em Meus projetos.</p>'+
            '<button class="btn-primary" data-nav="projetos" style="font-size:.8rem">Ver meu projeto</button>')
          :('<p style="font-size:.86rem;color:var(--text-3);margin-bottom:1rem">Você ainda não tem projetos cadastrados. Cadastre o primeiro e a MonyU te guia até a submissão.</p>'+
            '<button class="btn-primary" data-inicio-newproj style="font-size:.8rem">+ Cadastrar meu primeiro projeto</button>');
      }
    }else{
      if(wrap)wrap.style.display='';
      if(empty)empty.style.display='none';
    }
    if(isZeroMode){
      var ksA=$('#ksAtiv'),ksF=$('#ksFichas'),ksO=$('#ksOpps'),ksN=$('#ksNext');
      if(ksA)ksA.textContent='0';
      if(ksF)ksF.textContent='0';
      if(ksO)ksO.textContent=hasProj?'—':'R$ 0';
      if(ksN)ksN.textContent=hasProj?'Rodar o Rico':'Cadastrar 1º projeto';
    }
    /* Meus projetos: os 4 cards estáticos do HTML só representam a demo populada —
       em modo conta nova ficam ocultos e a lista some/aparece conforme PROJECTS. */
    var pStaticWrap=$('#projListStaticWrap'),pEmpty=$('#projListEmpty');
    if(isZeroMode){
      if(pStaticWrap)pStaticWrap.style.display='none';
      if(pEmpty)pEmpty.style.display=hasProj?'none':'';
      var psub=$('#projSub');
      if(psub)psub.textContent=Object.keys(PROJECTS).length+' de '+(typeof PROJ_LIMIT!=='undefined'?PROJ_LIMIT:5)+' projetos do plano Freemium · cadastro e importação gratuitos';
      var toolbar=document.querySelector('#view-projetos .toolbar');
      if(toolbar){
        var allChip=toolbar.querySelector('[data-pfilter="todos"]');
        if(allChip)allChip.textContent='Todos ('+Object.keys(PROJECTS).length+')';
        toolbar.querySelectorAll('[data-pfilter]:not([data-pfilter="todos"])').forEach(function(ch){ch.style.display='none'});
      }
    }
  }
  renderInicioZero();
  /* Delegado (não addEventListener direto): o botão de Início é recriado via innerHTML
     toda vez que renderInicioZero() roda, então um listener direto se perderia. */
  document.addEventListener('click',function(e){
    if(e.target.closest('[data-inicio-newproj]')){npSetMode('zero');open($('#newProjModal'))}
  });
  var projListEmptyBtn=$('#projListEmptyNewProj');
  if(projListEmptyBtn)projListEmptyBtn.addEventListener('click',function(){npSetMode('zero');open($('#newProjModal'))});
  /* Regra de produto (2026-07-14): a "Próxima ação recomendada" nunca é só um texto — sempre tem
     um caminho direto de 1 clique pra executar exatamente aquilo, sem o usuário ter que procurar
     onde clicar. Cobre os 3 estados possíveis do card. */
  var ksNextBtn=$('#ksNext');
  if(ksNextBtn)ksNextBtn.addEventListener('click',function(){
    if(isZeroMode){
      var zids=Object.keys(PROJECTS);
      if(zids.length===0){npSetMode('zero');open($('#newProjModal'));}
      else if(typeof openRun==='function'){openRun('rico',zids[0]);}
    }else if(typeof openWs==='function'){
      openWs();
    }
  });
  if(isZeroMode){
    var btnResumoZ=$('#btnResumo');if(btnResumoZ)btnResumoZ.style.display='none';
  }
  document.addEventListener('click',function(e){
    var uj=e.target.closest('[data-urgent-jump]');
    if(uj){
      urgentPanel.classList.remove('open');
      $('#urgentChipBtn').setAttribute('aria-expanded','false');
      showView('agentes');
    }
    if(e.target.closest('#urgentViewAll')){
      urgentPanel.classList.remove('open');
      $('#urgentChipBtn').setAttribute('aria-expanded','false');
    }
  });

  /* ================= Central de Aprovações ================= */
  /* Reaproveita JORNADA: itens com dataAgent+dataProj têm custo estimável e viram linha aprovável
     (checkbox); itens com dataOpp (ex.: "abrir oportunidade para decidir") não consomem fichas por si só —
     viram um botão de navegação, não uma linha de aprovação em lote. Nada começa marcado. */
  function aprovSorted(){
    return JORNADA.map(function(j,idx){return {j:j,idx:idx}}).sort(function(a,b){
      var da=a.j.days==null?9999:a.j.days,db=b.j.days==null?9999:b.j.days;
      return da-db;
    });
  }
  function aprovRow(entry){
    var j=entry.j,idx=entry.idx;
    var tier=urgencyTier(j.days);
    var daysLabel=j.days==null?'sem prazo definido':'⏱ '+j.days+' dias';
    var proj=PROJECTS[j.proj];
    if(j.dataAgent){
      var range=agentUnitRange(j.dataAgent);
      var isPromo=promoAppliesTo(j.dataAgent);
      var fMin=applyPromo(j.dataAgent,range[0]).final,fMax=applyPromo(j.dataAgent,range[1]).final;
      var baseLbl=range[0]===range[1]?String(range[0]):('estimativa '+range[0]+'–'+range[1]);
      var finalLbl=range[0]===range[1]?String(fMin):('estimativa '+fMin+'–'+fMax);
      var sfx=' ficha'+(range[1]>1?'s':'');
      var costLbl=isPromo
        ? ('<s class="promo-strike">'+baseLbl+'</s> <b class="promo-final">'+finalLbl+'</b>'+sfx+' <span class="promo-tag">-'+PROMO.pct+'%</span>')
        : (baseLbl+sfx);
      /* data-cost-min/max já refletem o valor REAL (com desconto, se houver) — é o que de fato será debitado */
      return '<div class="aprov-row" data-aprov="'+idx+'" data-cost-min="'+fMin+'" data-cost-max="'+fMax+'">'+
        '<input type="checkbox" data-aprovcb aria-label="Selecionar ação para '+proj.short+'">'+
        '<svg class="av" aria-hidden="true"><use href="'+avatarHref(j.agent)+'"/></svg>'+
        '<span class="aprov-body">'+
          '<span class="flow-days tier-'+tier+'">'+daysLabel+'</span> '+
          '<b>'+proj.short+'</b> — '+j.label+
          '<small>'+j.detail+'</small>'+
        '</span>'+
        '<span class="aprov-cost">'+costLbl+'</span>'+
      '</div>';
    }
    return '<div class="aprov-row aprov-row-nav">'+
      '<svg class="av" aria-hidden="true"><use href="'+avatarHref(j.agent)+'"/></svg>'+
      '<span class="aprov-body">'+
        '<span class="flow-days tier-'+tier+'">'+daysLabel+'</span> '+
        '<b>'+proj.short+'</b> — '+j.label+
        '<small>'+j.detail+'</small>'+
      '</span>'+
      '<button class="btn-ghost" data-opp="'+j.dataOpp+'" style="font-size:.74rem">Abrir oportunidade</button>'+
    '</div>';
  }
  function refreshAprov(){
    var rows=$$('#aprovList .aprov-row[data-aprov]');
    var n=0,total=0;
    rows.forEach(function(row){
      var cb=row.querySelector('[data-aprovcb]');
      row.classList.toggle('checked',cb.checked);
      if(cb.checked){
        n++;total+=parseInt(row.getAttribute('data-cost-max'),10);
      }
    });
    var foot=$('#aprovFoot');
    if(foot)foot.style.display=rows.length?'':'none';
    var sc=$('#aprovSelCount');if(sc)sc.textContent=n;
    var st=$('#aprovSelTotal');if(st)st.textContent=total;
    var ss=$('#aprovSaldo');if(ss)ss.textContent=saldo;
    var sa=$('#aprovSelAfter');if(sa)sa.textContent=Math.max(0,saldo-total);
    var btn=$('#aprovConfirm');
    if(!btn)return;
    if(n===0){btn.disabled=true;btn.removeAttribute('data-buy');btn.textContent='Selecione ao menos 1 ação';return}
    btn.disabled=false;
    if(total>saldo){
      var g=total-saldo;
      btn.setAttribute('data-buy',g);
      btn.textContent='Falta'+(g>1?'m':'')+' '+g+' ficha'+(g>1?'s':'')+' — resolver agora';
    }else{
      btn.removeAttribute('data-buy');
      btn.textContent='Aprovar e executar · '+total+' ficha'+(total>1?'s':'');
    }
  }
  function wireAprovEvents(){
    $$('#aprovList [data-aprovcb]').forEach(function(cb){cb.addEventListener('change',refreshAprov)});
    $$('#aprovList .aprov-row[data-aprov]').forEach(function(row){
      row.addEventListener('click',function(e){
        if(e.target.closest('[data-aprovcb]'))return;
        var cb=row.querySelector('[data-aprovcb]');
        cb.checked=!cb.checked;
        refreshAprov();
      });
    });
    var selAllBtn=$('#aprovSelAllBtn');
    if(selAllBtn)selAllBtn.onclick=function(){
      var boxes=$$('#aprovList [data-aprovcb]');
      if(!boxes.length)return;
      var allOn=Array.prototype.every.call(boxes,function(cb){return cb.checked});
      boxes.forEach(function(cb){cb.checked=!allOn});
      selAllBtn.textContent=allOn?'Selecionar todas':'Limpar seleção';
      refreshAprov();
    };
  }
  /* ================= Modo automático (N4 para todos) na Central de Aprovações =================
     Decisão do Evandro: sempre reversível, sempre com limite de fichas definido pelo próprio usuário,
     e ao bater o limite a seleção PAUSA e pede confirmação — nunca continua sozinha além do combinado. */
  var AUTO_MODE={active:false,limit:0};
  function autoModeApply(){
    if(!AUTO_MODE.active)return;
    var rows=$$('#aprovList .aprov-row[data-aprov]');
    var total=0,selected=0,skipped=0;
    rows.forEach(function(row){
      var cb=row.querySelector('[data-aprovcb]');
      if(!cb)return;
      var cost=parseInt(row.getAttribute('data-cost-max'),10);
      if(total+cost<=AUTO_MODE.limit){cb.checked=true;total+=cost;selected++}
      else{cb.checked=false;skipped++}
    });
    refreshAprov();
    var lim=$('#autoLimitTxt');if(lim)lim.textContent=AUTO_MODE.limit;
    var used=$('#autoUsed');if(used)used.textContent=total;
    if(skipped>0){
      toast('Modo automático selecionou '+selected+' ação(ões) · '+total+' ficha(s), dentro do seu limite de '+AUTO_MODE.limit+'. '+skipped+' ação(ões) ficaram de fora — aumente o limite ou aprove o que já foi selecionado. (demo)');
    }
  }
  var autoModeBtn=$('#autoModeBtn');
  if(autoModeBtn)autoModeBtn.addEventListener('click',function(){
    var inp=$('#autoLimitInput');if(inp)inp.value=AUTO_MODE.limit||50;
    open($('#autoModal'));
  });
  var autoConfirmBtn2=$('#autoConfirm');
  if(autoConfirmBtn2)autoConfirmBtn2.addEventListener('click',function(){
    var v=parseInt($('#autoLimitInput').value,10);
    if(!v||v<1){toast('Informe um limite de fichas válido para continuar.');return}
    AUTO_MODE.active=true;AUTO_MODE.limit=v;
    close($('#autoModal'));
    var bar=$('#autoStatusBar');if(bar)bar.style.display='';
    autoModeApply();
    if(typeof rwCntInc==='function'){rwCntInc('autopilot');rwRecalcAll()}
  });
  var autoPauseBtn=$('#autoPauseBtn');
  if(autoPauseBtn)autoPauseBtn.addEventListener('click',function(){
    AUTO_MODE.active=false;
    var bar=$('#autoStatusBar');if(bar)bar.style.display='none';
    toast('Modo automático pausado. Você voltou ao controle manual — nada fica pré-selecionado a partir de agora. (demo)');
  });
  function renderAprov(){
    var list=$('#aprovList');
    var execItems=JORNADA.filter(function(j){return j.dataAgent});
    if(list){
      var items=aprovSorted();
      list.innerHTML=items.map(aprovRow).join('');
      var empty=$('#aprovEmpty');if(empty)empty.style.display=items.length?'none':'';
      wireAprovEvents();
      if(AUTO_MODE.active)autoModeApply();else refreshAprov();
    }
    var tag=$('#navAprovTag');
    if(tag){
      if(execItems.length){tag.style.display='';tag.textContent=execItems.length}
      else{tag.style.display='none'}
    }
    var banner=$('#aprovBanner');
    if(banner){
      if(execItems.length){
        banner.style.display='';
        $('#aprovBannerSub').textContent=execItems.length+' ação'+(execItems.length>1?'ões':'')+' recomendada'+(execItems.length>1?'s':'')+' pelos seus agentes, aguardando sua aprovação — você decide o que rodar.';
      }else{banner.style.display='none'}
    }
  }
  var aprovConfirmBtn=$('#aprovConfirm');
  if(aprovConfirmBtn)aprovConfirmBtn.addEventListener('click',function(){
    var buyGap=this.getAttribute('data-buy');
    if(buyGap){resolverSaldo(parseInt(buyGap,10),'Você também pode desmarcar alguma ação para caber no saldo atual.',refreshAprov);return}
    var rows=$$('#aprovList .aprov-row[data-aprov]');
    var total=0,started=0,doneIdx=[],anyPromo=false,ranRico=false;
    rows.forEach(function(row){
      var cb=row.querySelector('[data-aprovcb]');
      if(!cb.checked)return;
      var idx=parseInt(row.getAttribute('data-aprov'),10);
      var j=JORNADA[idx];
      var cost=parseInt(row.getAttribute('data-cost-max'),10); /* já com desconto, se houver */
      var pname=PROJECTS[j.proj].name;
      total+=cost;started++;
      if(promoAppliesTo(j.dataAgent))anyPromo=true;
      startTask(j.dataAgent,AG[j.dataAgent].name+' — '+AGLABEL[j.dataAgent]+' · '+pname.substring(0,36)+(pname.length>36?'…':''),AG[j.dataAgent].name+' concluiu: '+AGLABEL[j.dataAgent]+' ('+pname.substring(0,26)+(pname.length>26?'…':'')+')',8000+Math.random()*6000);
      /* Recompensas (2026-07-14): toda execução real de agente conta, inclusive as aprovadas em lote
         aqui (Central de Aprovações) e as pré-selecionadas pelo modo automático — mesma regra usada
         em runConfirm, para nenhum caminho de execução ficar de fora do XP/selos. */
      if(typeof rwAddXp==='function'){
        rwAddXp(5);
        if(j.dataAgent==='rico'||j.dataAgent==='iris'||j.dataAgent==='aurora'||j.dataAgent==='mike'||j.dataAgent==='kai'){
          rwCntInc(j.dataAgent);
        }else if(j.dataAgent==='ada'){
          if(PROJECTS[j.proj]&&PROJECTS[j.proj].complete)rwCntInc('reengage');
          else rwCntInc('adaprojects');
        }
      }
      if(j.dataAgent==='rico')ranRico=true;
      doneIdx.push(idx);
    });
    if(started===0)return;
    if(typeof rwRecalcAll==='function')rwRecalcAll();
    if(ranRico&&typeof syncNavBadges==='function')syncNavBadges();
    saldo=Math.max(0,saldo-total);
    syncSaldo();
    doneIdx.sort(function(a,b){return b-a}).forEach(function(i){JORNADA.splice(i,1)});
    toast(started+' ação(ões) aprovada(s) e iniciada(s) — '+total+' fichas'+(anyPromo?' (com desconto de campanha)':'')+'. Acompanhe no canto da tela. (demo)');
    renderJornada();
    renderAprov();
  });
  renderAprov();

  /* ================= Matching sob demanda (a partir de uma oportunidade sem match) ================= */
  var pendOppMatch=null;
  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-oppmatch]');
    if(!b)return;
    pendOppMatch=b.getAttribute('data-oppmatch');
    openRun('rico');
  });
  function resolvePendingOppMatch(ids){
    if(!pendOppMatch)return;
    var o=OPPS.filter(function(x){return x.id===pendOppMatch})[0];
    if(o){
      var pool=(ids&&ids.length)?ids:Object.keys(PROJECTS);
      o.matches=pool.map(function(pid){return {p:pid,pct:40+Math.floor(Math.random()*50)}});
      renderOpps();
    }
    pendOppMatch=null;
  }

  /* Modo conta nova: scan genérico do Rico (não veio de um "Rodar matching" de um edital
     específico — resolvePendingOppMatch acima já cobre esse caso). Simula o Rico encontrando
     2 a 3 editais com match para o(s) projeto(s) recém-scaneados, sempre usando o nome real
     que o cliente deu ao projeto (via PROJECTS[pid].name, já usado em toda a renderização). */
  function ensureSyntheticMatches(ids){
    if(!ids||!ids.length)return;
    var already=OPPS.some(function(o){return o.matches.some(function(m){return ids.indexOf(m.p)>-1})});
    if(already)return;
    var picks=OPPS.slice().sort(function(){return Math.random()-0.5}).slice(0,2+Math.floor(Math.random()*2));
    picks.forEach(function(o){
      ids.forEach(function(pid){o.matches.push({p:pid,pct:58+Math.floor(Math.random()*35)})});
    });
    renderOpps();
    renderJornada();
  }

  /* ================= Filtros do radar ================= */
  function applyOppFilters(){
    var q=($('#oppSearch').value||'').toLowerCase();
    $$('#oppsFull .opp, #oppsUnmatched .opp').forEach(function(c){
      var o=OPPS.filter(function(x){return x.id===c.getAttribute('data-opp')})[0];
      if(!o)return;
      var txt=(o.nome+' '+o.fonte+' '+o.temas.join(' ')).toLowerCase();
      var okQ=txt.indexOf(q)>-1;
      var okF=oppFilter==='todas'
        || (oppFilter==='urgente'&&o.dias<30)
        || (oppFilter==='novas'&&c.classList.contains('opp-is-new'))
        || (o.fcat===oppFilter);
      c.style.display=(okQ&&okF)?'':'none';
    });
  }
  $$('.filter-chip[data-ofilter]').forEach(function(ch){
    ch.addEventListener('click',function(){
      $$('.filter-chip[data-ofilter]').forEach(function(x){x.classList.remove('on')});
      ch.classList.add('on');
      oppFilter=ch.getAttribute('data-ofilter');
      applyOppFilters();
    });
  });
  $('#oppSearch').addEventListener('input',applyOppFilters);

  /* ================= Filtros de projetos ================= */
  $$('.filter-chip[data-pfilter]').forEach(function(ch){
    ch.addEventListener('click',function(){
      $$('.filter-chip[data-pfilter]').forEach(function(x){x.classList.remove('on')});
      ch.classList.add('on');
      var f=ch.getAttribute('data-pfilter');
      $$('#projList .proj-card').forEach(function(c){
        c.style.display=(f==='todos'||c.getAttribute('data-pstatus')===f)?'':'none';
      });
    });
  });

  /* ================= Modal de oportunidade ================= */
  var oppModal=$('#oppModal'),oppBox=$('#oppModalBox');
  function pctClass(p){return p>=75?'hi':p>=55?'md':'lo'}
  function oppQuickMatchItem(m,o){
    var p=PROJECTS[m.p];
    var recHtml=oppRecHTML(m.p,o.id);
    return '<button type="button" class="omq-item" data-mp-jump="'+m.p+'">'+
      '<span class="omq-name">'+(p?p.name:m.p)+'</span>'+
      '<span class="omq-pct '+pctClass(m.pct)+'">'+m.pct+'%</span>'+
      (recHtml?'<span class="omq-rec">'+recHtml+'</span>':'')+
    '</button>';
  }
  function oppQuickMatchList(o){
    var sorted=o.matches.slice().sort(function(a,b){return b.pct-a.pct});
    return '<div class="omq-highlight"><h4>🎯 Seus projetos com match</h4>'+
      '<div class="omq-list">'+sorted.map(function(m){return oppQuickMatchItem(m,o)}).join('')+'</div>'+
    '</div>';
  }
  function openOpp(id){
    var o=OPPS.filter(function(x){return x.id===id})[0];if(!o)return;
    var html=''+
    '<button class="modal-close" id="oppClose" aria-label="Fechar">✕</button>'+
    '<div class="omodal-head">'+
      '<span class="omodal-logo">'+logoImg(o)+'</span>'+
      '<div>'+
        '<span class="opp-cat">'+o.cat+'</span>'+
        '<h3>'+o.nome+'</h3>'+
        '<span class="fonte">'+o.fonte+'</span>'+
        '<div class="opp-tags" style="margin-top:.5rem">'+o.temas.map(function(t){return '<span class="opp-tag thema">'+t+'</span>'}).join('')+'</div>'+
      '</div>'+
    '</div>'+
    oppQuickMatchList(o)+
    '<div class="key-stats">'+
      '<div class="kstat"><small>Valor da subvenção</small><b>'+o.valor+'</b></div>'+
      '<div class="kstat"><small>Contrapartida</small><b>'+o.contrapartida+'</b></div>'+
      '<div class="kstat"><small>Inscrições até</small><b class="urgent">'+o.inscricao+' · '+o.dias+' dias</b></div>'+
      '<div class="kstat"><small>Tempo de execução</small><b>'+o.execucao+'</b></div>'+
    '</div>'+
    '<div class="osec"><h4>Objetivo</h4><p>'+o.objetivo+'</p></div>'+
    '<div class="osec"><h4>Público-alvo</h4><p>'+o.publico+'</p></div>'+
    '<div class="osec"><h4>Requisitos de elegibilidade</h4><ul>'+o.requisitos.map(function(r){return '<li>'+r+'</li>'}).join('')+'</ul></div>'+
    '<div class="osec"><h4>Cronograma completo</h4><div class="timeline">'+
      o.cronograma.map(function(c){return '<div class="tl-item '+c.s+'"><b>'+c.d+'</b><span>'+c.t+'</span></div>'}).join('')+
    '</div></div>'+
    '<div class="osec"><h4>Edital oficial</h4><p><a href="#" id="oppLink">🔗 '+o.link+'</a></p></div>'+
    '<div class="osec" id="oppActionSec" style="margin-bottom:0"><h4>Seus projetos com match — escolha a ação para cada projeto</h4>'+
      '<p class="osec-hint"><b>Você no controle.</b> Marque o projeto e escolha a ação desejada para incluí-lo na execução — nada roda sem a sua confirmação.</p>'+
      '<div class="match-select">'+
      o.matches.map(function(m,i){
        var proj=PROJECTS[m.p];
        var rec=rowRecommendedAct(proj);
        var diagBtn='<button class="act-chip'+(rec==='diag'?' rec':'')+'" data-act="diag">Diagnóstico Íris · '+costBadgeHTML('iris',5)+(rec==='diag'?'<span class="act-rec-tag">Recomendado</span>':'')+'</button>';
        var altBtn=proj.complete
          ? '<button class="act-chip'+(rec==='adapt'?' rec':'')+'" data-act="adapt">Adaptar com Ada · '+costBadgeHTML('ada',5)+(rec==='adapt'?'<span class="act-rec-tag">Recomendado</span>':'')+'</button>'
          : '<button class="act-chip'+(rec==='psf'?' rec':'')+'" data-act="psf">Rodar PSF com Kai · '+costBadgeHTML('kai',10)+(rec==='psf'?'<span class="act-rec-tag">Recomendado</span>':'')+'</button>';
        return '<div class="match-row" data-mrow="'+m.p+'">'+
          '<input type="checkbox" data-mp aria-label="Selecionar projeto">'+
          '<svg class="av" style="width:32px;height:32px" data-mav aria-hidden="true"><use href="#av-iris"/></svg>'+
          '<span class="mr-name">'+proj.name+
            '<small>'+(proj.complete?'projeto 100% elaborado na plataforma':'projeto em construção')+' · match com os critérios do edital</small>'+
            '<span class="mr-actions">'+diagBtn+altBtn+'</span>'+
          '</span>'+
          '<span class="mr-pct '+pctClass(m.pct)+'">'+m.pct+'%</span>'+
        '</div>';
      }).join('')+
      '</div>'+
    '</div>'+
    '<div class="omodal-foot">'+
      '<div class="foot-preview">'+
        '<span><b id="selCount">0</b> ação(ões) selecionada(s) = <b id="selTotal">0</b> fichas</span>'+
        '<span>Saldo: <b>'+saldo+'</b> → <b class="after" id="selAfter">'+saldo+'</b> fichas</span>'+
      '</div>'+
      '<div class="modal-actions">'+
        '<button class="btn-ghost" id="oppCancel">Fechar</button>'+
        '<button class="btn-primary" id="oppRun" disabled>Selecione ao menos 1 projeto</button>'+
      '</div>'+
    '</div>';
    oppBox.innerHTML=html;
    open(oppModal);
    var rows=oppBox.querySelectorAll('.match-row');
    function rowAct(row){var c=row.querySelector('.act-chip.on');return c?c.getAttribute('data-act'):null}
    function refresh(){
      var n=0,total=0,incomplete=0;
      rows.forEach(function(row){
        var cb=row.querySelector('[data-mp]');
        row.classList.toggle('checked',cb.checked);
        var actKey=rowAct(row),av=row.querySelector('[data-mav] use');
        if(actKey){
          var act=ACTIONS[actKey];
          av.setAttribute('href','#av-'+act.key);
          row.classList.remove('needs-act');
          if(cb.checked){n++;total+=applyPromo(act.key,act.cost).final}
        }else{
          av.setAttribute('href','#av-iris');
          row.classList.toggle('needs-act',cb.checked);
          if(cb.checked)incomplete++;
        }
      });
      oppBox.querySelector('#selCount').textContent=n;
      oppBox.querySelector('#selTotal').textContent=total;
      oppBox.querySelector('#selAfter').textContent=Math.max(0,saldo-total);
      var btn=oppBox.querySelector('#oppRun');
      if(n===0&&incomplete===0){btn.disabled=true;btn.removeAttribute('data-buy');btn.textContent='Selecione ao menos 1 projeto'}
      else if(incomplete>0){btn.disabled=true;btn.removeAttribute('data-buy');btn.textContent='Escolha uma ação para cada projeto marcado'}
      else if(total>saldo){
        var g=total-saldo;
        btn.disabled=false;btn.setAttribute('data-buy',g);
        btn.textContent='Falta'+(g>1?'m':'')+' '+g+' ficha'+(g>1?'s':'')+' — resolver agora';
      }else{btn.disabled=false;btn.removeAttribute('data-buy');btn.textContent='Executar · '+total+' fichas'}
    }
    rows.forEach(function(row){
      row.addEventListener('click',function(e){
        var chip=e.target.closest('.act-chip');
        if(chip){
          var wasOn=chip.classList.contains('on');
          row.querySelectorAll('.act-chip').forEach(function(x){x.classList.remove('on')});
          var cb=row.querySelector('[data-mp]');
          if(wasOn){cb.checked=false}
          else{chip.classList.add('on');cb.checked=true}
          refresh();return;
        }
        if(e.target.closest('[data-mp]')){
          var cb2=row.querySelector('[data-mp]');
          if(!cb2.checked)row.querySelectorAll('.act-chip').forEach(function(x){x.classList.remove('on')});
          refresh();return;
        }
        var cb=row.querySelector('[data-mp]');
        cb.checked=!cb.checked;
        if(!cb.checked)row.querySelectorAll('.act-chip').forEach(function(x){x.classList.remove('on')});
        refresh();
      });
    });
    refresh();
    oppBox.querySelectorAll('[data-mp-jump]').forEach(function(btn){
      btn.addEventListener('click',function(){
        var pid=btn.getAttribute('data-mp-jump');
        var row=oppBox.querySelector('.match-row[data-mrow="'+pid+'"]');
        if(!row)return;
        row.scrollIntoView({behavior:'smooth',block:'center'});
        row.classList.add('jump-hi');
        setTimeout(function(){row.classList.remove('jump-hi')},1400);
      });
    });
    oppBox.querySelector('#oppClose').addEventListener('click',function(){close(oppModal)});
    oppBox.querySelector('#oppCancel').addEventListener('click',function(){close(oppModal)});
    oppBox.querySelector('#oppLink').addEventListener('click',function(e){e.preventDefault();toast('Link externo do edital — desabilitado no piloto (demo)')});
    oppBox.querySelector('#oppRun').addEventListener('click',function(){
      var buyGap=this.getAttribute('data-buy');
      if(buyGap){resolverSaldo(parseInt(buyGap,10),'Você também pode desmarcar um projeto ou trocar a ação para caber no saldo atual.',refresh);return}
      var total=0,started=0;
      rows.forEach(function(row){
        var cb=row.querySelector('[data-mp]');
        if(!cb.checked)return;
        var actKey=rowAct(row);
        if(!actKey)return;
        var act=ACTIONS[actKey];
        var pid=row.getAttribute('data-mrow');
        var pname=PROJECTS[pid].name;
        total+=applyPromo(act.key,act.cost).final;started++;
        startTask(act.key,act.label+' — '+pname.substring(0,40)+'… ('+o.abbr+')',act.label+' concluída — '+o.abbr,8000+Math.random()*6000);
        /* Recompensas (2026-07-14): mesma regra de runConfirm/aprovConfirmBtn — rodar uma ação
           daqui (matching por oportunidade) também conta XP + selo do agente. */
        if(typeof rwAddXp==='function'){
          rwAddXp(5);
          if(act.key==='rico'||act.key==='iris'||act.key==='aurora'||act.key==='mike'||act.key==='kai'){
            rwCntInc(act.key);
          }else if(act.key==='ada'){
            if(PROJECTS[pid]&&PROJECTS[pid].complete)rwCntInc('reengage');
            else rwCntInc('adaprojects');
          }
        }
      });
      if(started===0)return;
      if(typeof rwRecalcAll==='function')rwRecalcAll();
      saldo=Math.max(0,saldo-total);
      syncSaldo();
      close(oppModal);
      toast(started+' atividade(s) iniciada(s) — '+total+' fichas. Acompanhe no canto da tela. (demo)');
    });
  }
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-opp]');
    if(t)openOpp(t.getAttribute('data-opp'));
  });

  /* ================= Central de atividade dos agentes ================= */
  var tray=$('#tray'),trayList=$('#trayList'),trayPill=$('#trayPill'),trayMin=false,activeCount=0;
  function updateTray(){
    if(trayList.children.length===0){tray.classList.remove('show');trayPill.classList.remove('show');return}
    $('#trayCount').textContent=activeCount>0?'· '+activeCount+' em execução':'· concluídas';
    $('#traySpin').style.display=activeCount>0?'block':'none';
    if(trayMin){
      tray.classList.remove('show');trayPill.classList.add('show');
      $('#pillLabel').textContent=activeCount>0?activeCount+' agente(s) trabalhando…':'Atividades concluídas — ver';
      $('#pillSpin').style.display=activeCount>0?'block':'none';
    }else{tray.classList.add('show');trayPill.classList.remove('show')}
  }
  function addNotif(agentKey,html){
    var b=document.createElement('button');
    b.className='notif-item';
    b.innerHTML='<svg class="av" aria-hidden="true"><use href="#av-'+agentKey+'"/></svg><p>'+html+'<span class="ntime">agora</span></p><span class="undot" aria-hidden="true"></span>';
    $('#notifList').prepend(b);
    $('#notifDot').style.display='';
  }
  function startTask(agentKey,label,doneLabel,dur){
    dur=dur||9000;activeCount++;
    var item=document.createElement('div');
    item.className='tray-item';
    item.innerHTML='<svg class="av" aria-hidden="true"><use href="#av-'+agentKey+'"/></svg>'+
      '<div class="t-body"><div class="t-label"></div><div class="tray-prog"><i></i></div></div>';
    item.querySelector('.t-label').textContent=label;
    trayList.prepend(item);
    updateTray();
    var bar=item.querySelector('.tray-prog i');
    requestAnimationFrame(function(){
      bar.style.transition='width '+Math.round(dur)+'ms cubic-bezier(.3,.7,.4,1)';
      bar.style.width='92%';
    });
    setTimeout(function(){
      bar.style.transition='width .4s cubic-bezier(.4,0,.2,1)';
      bar.style.width='100%';
      item.classList.add('done');
      item.querySelector('.t-label').textContent=doneLabel;
      var view=document.createElement('button');view.className='t-view';view.textContent='Ver resultado';
      view.addEventListener('click',function(){if(agentKey==='ada'){openWs()}else{toast('Abrindo o resultado — visualização completa em breve no piloto (demo)')}});
      var x=document.createElement('button');x.className='t-x';x.setAttribute('aria-label','Dispensar');x.textContent='✕';
      x.addEventListener('click',function(){item.remove();updateTray()});
      item.appendChild(view);item.appendChild(x);
      activeCount=Math.max(0,activeCount-1);
      addNotif(agentKey,'<b>'+doneLabel+'</b>. O resultado já está disponível para você.');
      toast(doneLabel+' — resultado disponível. (demo)');
      updateTray();
    },dur);
  }
  $('#trayMin').addEventListener('click',function(){trayMin=true;updateTray()});
  trayPill.addEventListener('click',function(){trayMin=false;updateTray()});

  /* ================= Resumo da semana ================= */
  $('#btnResumo').addEventListener('click',function(){open($('#sumModal'))});
  $('#sumCta').addEventListener('click',function(){close($('#sumModal'));openRun('ada','p1')});

  /* ================= Comprar fichas ================= */
  var buyModal=$('#buyModal'),packQty=50,packPrice=175;
  function refreshBuy(){
    var disc=(typeof rwDiscountPct==='function')?rwDiscountPct():0;
    var price=packPrice*(1-disc/100);
    $('#buyAfter').textContent=saldo+packQty;
    $('#buyConfirm').textContent='Comprar '+packQty+' fichas · R$ '+price.toFixed(2).replace('.',',')+(disc?' (nível '+rwLevelInfo().level.name+' · -'+disc+'%)':'');
  }
  $$('#packsGrid .pack').forEach(function(p){
    p.addEventListener('click',function(){
      $$('#packsGrid .pack').forEach(function(x){x.classList.remove('sel')});
      p.classList.add('sel');
      packQty=parseInt(p.getAttribute('data-qty'),10);
      packPrice=parseFloat(p.getAttribute('data-price'));
      refreshBuy();
    });
  });
  function openBuy(){refreshBuy();open(buyModal)}
  $('#fichasChip').addEventListener('click',openBuy);
  $('#btnBuy1').addEventListener('click',openBuy);
  $('#buyConfirm').addEventListener('click',function(){
    saldo+=packQty;
    syncSaldo();
    close(buyModal);
    toast(packQty+' fichas adicionadas ao seu saldo — pagamento simulado. (demo)');
  });

  /* ================= Planos ================= */
  var plansModal=$('#plansModal');
  function openPlans(){open(plansModal)}
  $('#btnPlans1').addEventListener('click',openPlans);
  $('#navFichas').addEventListener('click',function(e){e.preventDefault();openPlans()});
  $('#linkPlans2').addEventListener('click',function(e){e.preventDefault();openPlans()});

  /* ================= Cadastrar projeto (com importação) ================= */
  /* Teto de projetos ativos por plano (decisão de 2026-07-14): Freemium 3, Starter 10 — ainda usado
     como gatilho de upgrade — Pro e Scale ilimitados (não geram este bloqueio). O piloto só simula
     2 contas (Freemium em modo zero, Starter na demo populada), por isso o teto é resolvido aqui a
     partir de isZeroMode em vez de existir uma seleção de plano de verdade. */
  var PROJ_LIMIT=(isZeroMode?3:10),npMode='zero',NP_TYPES=['Projeto completo','Pitch deck','Roteiro de pitch','Lean canvas','Orçamento','Outro'];
  function npSetMode(m){
    npMode=m;
    $$('.np-mode').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-npmode')===m)});
    $('#npTitle').textContent=m==='import'?'Importar projeto existente':'Novo projeto';
    $('#npSave').textContent=m==='import'?'Importar projeto':'Salvar projeto';
    $('#npDocsHint').textContent=m==='import'?'— envie o projeto escrito, pitch e materiais de apoio':'— opcional, melhora os outputs dos agentes';
  }
  document.addEventListener('click',function(e){
    var mb=e.target.closest('[data-npmode]');
    if(mb)npSetMode(mb.getAttribute('data-npmode'));
  });
  function npAddDoc(name,ext,type){
    var row=document.createElement('div');
    row.className='np-doc';
    row.innerHTML='<span class="kd-ico">'+ext+'</span><span class="nd-name"></span>'+
      '<button class="np-type" data-cycle data-tip="Clique para trocar o tipo">'+type+'</button>'+
      '<label class="np-scope" data-tip="Padrão: somente este projeto"><span class="switch kb-scope-switch"><input type="checkbox" data-scope><span class="track-sw"></span><span class="thumb"></span></span> Global</label>'+
      '<button class="np-x" aria-label="Remover documento">✕</button>';
    row.querySelector('.nd-name').textContent=name;
    row.querySelector('.np-x').addEventListener('click',function(){row.remove()});
    row.querySelector('[data-cycle]').addEventListener('click',function(){
      var ix=NP_TYPES.indexOf(this.textContent);
      this.textContent=NP_TYPES[(ix+1)%NP_TYPES.length];
    });
    row.querySelector('[data-scope]').addEventListener('change',function(){
      toast(this.checked?'Este documento ficará acessível a TODOS os agentes e projetos.':'Documento restrito a este projeto.');
    });
    $('#npDocList').appendChild(row);
  }
  $('#npDrop').addEventListener('click',function(){
    if(npMode==='import'){
      npAddDoc('Projeto_completo_v3.pdf','PDF','Projeto completo');
      npAddDoc('PitchDeck_2026.pdf','PDF','Pitch deck');
      npAddDoc('Roteiro_pitch.docx','DOC','Roteiro de pitch');
      npAddDoc('LeanCanvas.png','IMG','Lean canvas');
      toast('4 documentos na fila — tipos sugeridos automaticamente, clique no tipo para ajustar. (demo)');
    }else{
      npAddDoc('Referencias_tecnicas.pdf','PDF','Outro');
      toast('1 documento na fila de indexação. (demo)');
    }
  });
  function syncNpSlotsLabel(){
    var maxEl=$('#npSlotsMax');if(maxEl)maxEl.textContent=PROJ_LIMIT;
    var planEl=$('#npPlanName');if(planEl)planEl.textContent=isZeroMode?'Freemium':'Starter';
    var slotsEl=$('#npSlots');if(slotsEl)slotsEl.textContent=Object.keys(PROJECTS).length;
  }
  $('#btnNewProj').addEventListener('click',function(){
    if(Object.keys(PROJECTS).length>=PROJ_LIMIT){
      toast('Seu plano '+(isZeroMode?'Freemium':'Starter')+' comporta '+PROJ_LIMIT+' projetos ativos. Faça upgrade para adicionar mais.');
      openPlans();return;
    }
    npSetMode('zero');
    syncNpSlotsLabel();
    open($('#newProjModal'));
  });
  var projSeq=4;
  $('#npSave').addEventListener('click',function(){
    var nome=($('#npNome').value||'').trim();
    if(!nome){toast('Dê um nome ao projeto antes de salvar');$('#npNome').focus();return}
    projSeq++;
    var pid='p'+projSeq,tema=$('#npTema').value,hoje='06 jul 2026';
    PROJECTS[pid]={name:nome,short:nome.length>28?nome.substring(0,26)+'…':nome,complete:false,stage:'new',tema:tema};
    var docRows=$$('#npDocList .np-doc'),nDocs=docRows.length;
    docRows.forEach(function(row){
      DOCS.push({
        n:row.querySelector('.nd-name').textContent,
        type:row.querySelector('[data-cycle]').textContent,
        orig:'upload',date:hoje,use:'—',
        proj:row.querySelector('[data-scope]').checked?null:pid
      });
    });
    if(typeof renderKb==='function')renderKb();
    var imported=(npMode==='import'&&nDocs>0);
    var card=document.createElement('article');
    card.className='proj-card';
    card.setAttribute('data-pstatus','rascunho');
    card.innerHTML=
      '<div class="proj-head">'+
        projIconHTML(nome,tema)+
        '<div class="proj-title"><b></b><span>'+(imported?'Importado':'Rascunho')+' · Tema: '+tema+' · criado em '+hoje+(nDocs?' · '+nDocs+' documento(s) na Memória':'')+'</span></div>'+
        '<span class="stage-chip draft-chip">'+(imported?'Importado':'Rascunho')+'</span>'+
      '</div>'+
      '<div class="proj-meta">'+
        '<div>Próximo passo<b>Rodar Rico (radar)</b></div>'+
        '<div>Memória do projeto<b>'+nDocs+' doc(s)</b></div>'+
        '<div>Fichas investidas<b>0</b></div>'+
      '</div>'+
      '<div class="proj-actions">'+
        '<button class="btn-primary" data-agent="rico" data-proj="'+pid+'" style="font-size:.74rem">Buscar oportunidades · '+costBadgeHTML('rico',1)+'</button>'+
        '<button class="btn-ghost" data-agent="iris" data-proj="'+pid+'">Testar aderência com a Íris · '+costBadgeHTML('iris',5)+'</button>'+
      '</div>';
    card.querySelector('b').textContent=nome;
    $('#projList').appendChild(card);
    var slots=Object.keys(PROJECTS).length;
    var slotsEl=$('#npSlots');if(slotsEl)slotsEl.textContent=slots;
    var psub=$('#projSub');if(psub)psub.textContent=slots+' de '+PROJ_LIMIT+' projetos do plano '+(isZeroMode?'Freemium':'Starter')+' · cadastro e importação gratuitos';
    syncNavBadges();
    $('#npNome').value='';$('#npDesc').value='';$('#npDocList').innerHTML='';
    close($('#newProjModal'));
    if(typeof renderInicioZero==='function')renderInicioZero();
    if(isZeroMode&&typeof wsApplyProjName==='function')wsApplyProjName(nome);
    toast(imported
      ?'Projeto "'+nome+'" importado com '+nDocs+' documentos! Sugestão: Rico encontra editais com match (1 ficha) e a Íris testa a aderência antes de qualquer adaptação. (demo)'
      :'Projeto "'+nome+'" cadastrado! Rode o Rico para encontrar oportunidades. (demo)');
    if(obImport){obImport=false;openNextSteps(pid)}
    else if(pendingRunAgent){var ag=pendingRunAgent;pendingRunAgent=null;openRun(ag,pid)}
  });

  /* ================= Meus Agentes ================= */
  function avatarHref(k){return '#av-'+k}
  var AGD=[
    {k:'rico',name:'Rico',role:'Radar + matching de oportunidades',badge:'on',badgeTxt:'Disponível',cost:'1 a 3 fichas por rodada',time:'~2 min',
      benefit:'Vigia centenas de fontes de fomento do país e avisa quando surge um edital com a cara dos seus projetos.',
      action:'Executar scan · 1 a 3 fichas',
      does:['Varre FINEP, EMBRAPII, FAPs estaduais, CNPq e Sistema S','Calcula o score de match para cada projeto seu','Roda um checklist objetivo de premissas do edital: [x] o que o projeto já cumpre, [ ] o que falta — com dica simples de como resolver','Monitora prazos e alerta antes de os editais fecharem'],
      nots:['Não avalia a qualidade do projeto nem critérios qualitativos — isso é com a Íris (e Ada, na elaboração)','Não executa nada sem a sua confirmação'],
      hist:[{d:'hoje 08:12',t:'Scan semanal: 3 oportunidades novas (melhor match: FINEP 92%)'},{d:'29 jun',t:'Scan: 2 oportunidades para a Plataforma IoT'}],
      faq:[['Posso agendar scans automáticos?','Sim — semanais ou quinzenais, sempre com aviso prévio.'],['Por que o custo varia entre 1 e 3 fichas?','1 ficha roda o radar para um único projeto. 3 fichas rodam o lote completo — até 5 projetos numa única varredura, o que sai mais barato por projeto.'],['De onde vêm as oportunidades?','De fontes oficiais monitoradas continuamente pelo Núcleo de Memória MonyU.']]},
    {k:'aurora',name:'Aurora',role:'Discovery estratégico de funding',badge:'on',badgeTxt:'Disponível',cost:'15 fichas por projeto',time:'~1 h',
      benefit:'O mapa completo do potencial de captação do seu negócio: mercado, tese de funding e rotas de recurso.',
      action:'Executar discovery · a partir de 15 fichas',
      does:['Discovery estratégico completo em PDF + HTML','Tese de funding personalizada para o seu negócio','Mapa de oportunidades por horizonte de tempo'],
      nots:['Não substitui o radar contínuo do Rico — ela é a foto estratégica'],
      hist:[],
      faq:[['Quando usar Aurora e quando usar Rico?','Aurora é a análise estratégica completa (1–2x por ano); Rico é o radar contínuo do dia a dia.']]},
    {k:'romeu',name:'Romeu',role:'PD&I e horizontes de crescimento',badge:'soon',badgeTxt:'Em especificação',cost:'15 fichas por geração',time:'A calibrar',soon:true,
      benefit:'Pesquisa novas aplicações da sua solução e monta o roadmap de crescimento pelos 3 horizontes — para você deixar de esperar edital aparecer e criar o próprio pipeline de projetos.',
      does:['Pesquisa novas aplicações e variações da sua solução a partir de sinais e tendências de futuro','Estrutura o roadmap pelos 3 horizontes de crescimento (atual, adjacente, transformacional)','Usa o que já existe no seu Núcleo de Memória — projeto escrito (Ada) e pesquisa acumulada (Kai, Bartô, Aurora) — como insumo principal'],
      nots:['Rende pouco sem histórico prévio — funciona melhor depois que já existem projeto e pesquisa na Memória','Não decide sozinho qual horizonte perseguir — apresenta o roadmap para você priorizar'],
      hist:[],
      faq:[['Quando chamar o Romeu?','Depois de já ter projeto escrito (Ada) e alguma pesquisa acumulada (Kai, Bartô ou Aurora) — ele usa isso como base.'],['Quando chega?','Em especificação. Clique em Avisar-me para ser notificado no lançamento.']]},
    {k:'mike',name:'Mike',role:'Tese de funding: radar + roadmap de captação',badge:'on',badgeTxt:'Disponível',cost:'20 fichas por projeto',time:'~1 h',
      benefit:'Vai além da subvenção econômica: mapeia o momento do seu negócio contra o potencial de incentivos fiscais, investimento, capital de risco e fomento internacional, com um plano de evolução priorizado.',
      action:'Elaborar tese de funding · a partir de 20 fichas',
      does:['Mapeia o momento atual do negócio e cruza com o potencial de diferentes modalidades de captação além de subvenção econômica','Radar de aderência por modalidade (incentivo fiscal, investimento, capital de risco, fomento internacional e outros mecanismos de inovação)','Roadmap de evolução e oportunidades do calendário anual de editais','Checklist de ações para destravar cada modalidade'],
      nots:['Esta versão do piloto ainda não gera a tese completa — a experiência disponível aqui é a de seleção e consumo da ficha do agente','Não substitui o discovery de mercado da Aurora — as duas entregas se complementam'],
      hist:[],
      faq:[['Qual a diferença entre Mike e Aurora?','Aurora mapeia mercado, tendências e a tese de captação do seu negócio. Mike foca no plano de captação de recursos em si — para além da subvenção econômica.']]},
    {k:'iris',name:'Íris',role:'Potencial de captação (avulso ou por edital)',badge:'on',badgeTxt:'Disponível',cost:'5 fichas por projeto',time:'~15 min',
      benefit:'Diz se vale a pena competir por um edital — ou qual o potencial geral de captação do projeto — antes de você investir tempo e fichas na escrita.',
      action:'Executar diagnóstico · a partir de 5 fichas',
      does:['Avalia critérios qualitativos: modelo de negócio, maturidade da solução, equipe, conexão com academia, ODS, alinhamento com políticas públicas, potencial inovador','Roda avulso (potencial do projeto para a maioria das oportunidades) ou específico (reforço para um edital determinado)','Entrega um score próprio da metodologia MonyU — versão aprofundada do diagnóstico gratuito'],
      nots:['Não reescreve o projeto — recomenda caminhos','Não substitui a leitura do edital oficial'],
      hist:[{d:'ontem 17:40',t:'Diagnóstico Plataforma IoT: potencial alto, 2 editais recomendados'}],
      faq:[['O diagnóstico garante aprovação?','Não. Ele reduz o risco e mostra o que fortalecer antes de submeter.'],['Posso rodar para vários editais?','Sim — cada combinação projeto × edital consome 5 fichas.']]},
    {k:'kai',name:'Kai',role:'Problem-Solution Fit (Ishikawa)',badge:'beta',badgeTxt:'Beta',cost:'10 fichas por projeto',time:'~30 min',
      benefit:'Testa se o seu problema-solução para em pé antes de você gastar fichas com a escrita.',
      action:'Iniciar sessão · a partir de 10 fichas',
      does:['Sessão estruturada pelo método Ishikawa','Identifica causas-raiz e hipóteses frágeis','Fortalece a narrativa antes da elaboração'],
      nots:['Não escreve o projeto — prepara o terreno para a Ada'],
      hist:[{d:'25 jun',t:'Sessão PSF do projeto Hidrogênio verde: 3 hipóteses a validar'}],
      faq:[['Quando rodar o Kai?','Antes da Ada, sempre que o problema ainda estiver difuso ou o projeto for novo.']]},
    {k:'barto',name:'Bartô',role:'Gate de viabilidade integrada',badge:'soon',badgeTxt:'Em desenvolvimento',cost:'15 fichas por estudo',time:'A calibrar',soon:true,gate:true,
      benefit:'Confronta a tese por mercado, demanda, competição, jurídico, operação, tecnologia, finanças, sustentabilidade e risco antes de você comprometer esforço, capital ou reputação.',
      does:['Orquestra 19 especialistas em seis fases e seleciona a profundidade pela materialidade do caso','Integra evidências, premissas, cálculos, cenários, riscos, scorecard e sabatina','Assina uma recomendação rastreável: avançar, avançar com condições, pivotar, adiar e validar ou não avançar','Entrega as condições e experimentos que precisam ser resolvidos antes da elaboração ou do investimento'],
      nots:['Não substitui Aurora: ela descobre onde jogar; Bartô decide se a tese deve avançar','Não substitui Kai: ele testa o encaixe problema-solução','Não escreve o projeto para o edital e não substitui A Banca','Runtime e calibração de tempo/qualidade ainda não estão ativos nesta versão do protótipo; o preço ao cliente já foi definido em 15 fichas por estudo'],
      hist:[],
      faq:[['Quando chamar Bartô?','Depois de Aurora, Íris ou Kai e antes de Carlito/Ada quando houver investimento, contrapartida, novidade ou risco material.'],['Bartô é obrigatório em toda captação?','Não. Adaptações simples de projetos maduros podem dispensá-lo com racional registrado.'],['Quanto custa?','15 fichas por estudo, o mesmo custo da Aurora. Os modos mudam a profundidade da análise, não o preço atual.']]},
    {k:'eros',name:'Eros',role:'Matching de executores e ICTs',badge:'soon',badgeTxt:'Em breve · 2027',cost:'5 fichas por busca',time:'—',soon:true,
      benefit:'Vai encontrar o pesquisador, consultor ou ICT certo para executar o projeto junto com você.',
      does:['Matching com a rede MonyU de executores','Perfis verificados e histórico de entregas','Conexão sempre dentro da plataforma'],
      nots:[],hist:[],
      faq:[['Quando chega?','Previsto para 2027, junto com o GigaMonyU.']]},
    {k:'ada',name:'Ada',role:'Elaboração do projeto por edital',badge:'beta',badgeTxt:'Beta · revisão humana',cost:'20 fichas por projeto · adaptação 5',time:'~40 min',
      benefit:'Escreve a primeira versão inteira do seu projeto no formato exato que o edital pede.',
      action:'Elaborar projeto · a partir de 20 fichas',warn:true,
      does:['Elabora seção por seção conforme o edital','Adapta projetos 100% elaborados na plataforma para novos editais por 5 fichas','Aprende com o histórico de projetos aprovados do Núcleo MonyU'],
      nots:['Não submete nada sem revisão humana — ela é obrigatória','Não inventa dados da sua empresa: quando falta informação, ela pergunta'],
      hist:[{d:'ontem 11:05',t:'Metodologia e cronograma do projeto Microrredes prontos para revisão'},{d:'30 jun',t:'Objetivos e justificativa do projeto Microrredes concluídos'}],
      faq:[['Por que a revisão humana é obrigatória?','IA pode errar. Projeto reprovado por erro evitável custa caro — a revisão protege você e o seu resultado.'],['O que é a adaptação por 5 fichas?','Ajustar um projeto já 100% elaborado na plataforma para outro edital compatível.']]},
    {k:'carlito',name:'Carlito',role:'Checklist documental + certidões',badge:'soon',badgeTxt:'Em breve · out/2026',cost:'5 fichas por checklist',time:'—',soon:true,
      benefit:'Vai montar o checklist documental do edital e monitorar suas certidões — a parte chata, resolvida.',
      does:['Checklist documental específico por edital','Status e validade das suas certidões','Alertas antes de documentos vencerem'],
      nots:['Não emite documentos em seu nome'],hist:[],
      faq:[['Quando chega?','Previsto para out/2026. Clique em Avisar-me para ser notificado no lançamento.']]},
    {k:'banca',name:'A Banca',role:'Avaliação simulada do projeto',badge:'soon',badgeTxt:'Em breve · nov/2026',cost:'10 fichas por avaliação',time:'—',soon:true,
      benefit:'Uma banca de avaliadores simulados dá nota no seu projeto antes da banca real.',
      does:['Simula os critérios de avaliação do edital','Nota por quesito + parecer detalhado','Sugestões de melhoria priorizadas'],
      nots:['Não substitui a avaliação oficial do órgão'],hist:[],
      faq:[['Quando chega?','Previsto para nov/2026.']]},
    {k:'laura',name:'Laura',role:'Roteiro e pitch deck do projeto',badge:'soon',badgeTxt:'Em especificação',cost:'5 fichas o roteiro · 25 fichas a apresentação',time:'A calibrar',soon:true,
      benefit:'Escreve o roteiro e monta a apresentação do seu projeto — genérica, para investidor, ou adaptada a um edital específico.',
      does:['Roteiro do pitch em TXT/PDF','Apresentação completa em PPTX, PDF e ZIP de imagens em alta resolução, um arquivo por slide','Adapta a mesma história para investidor ou para um edital específico'],
      nots:['Não edita a apresentação dentro da plataforma nesta fase — o ajuste fino é feito no seu editor preferido','Roteiro e apresentação completa são dois produtos com preços distintos, não uma versão básica da mesma entrega'],
      hist:[],
      faq:[['Roteiro e apresentação são a mesma coisa?','Não — são dois produtos distintos, com preços distintos. O roteiro (5 fichas) é o texto em TXT/PDF; a apresentação completa (25 fichas) inclui os slides.'],['Quando chega?','Em especificação. Clique em Avisar-me para ser notificado no lançamento.']]},
    {k:'clara',name:'Clara',role:'Prestação de contas pós-aprovação',badge:'soon',badgeTxt:'Em breve · 2027',cost:'20 fichas por prestação',time:'—',soon:true,
      benefit:'Vai cuidar da prestação de contas do recurso aprovado, no padrão de cada financiador e sem sustos.',
      does:['Cronograma de prestação por financiador','Checagem de notas fiscais e rubricas','Relatórios no formato exigido pelo órgão'],
      nots:[],hist:[],
      faq:[['Quando chega?','Previsto para 2027.']]},
    {k:'rui',name:'Rui',role:'Recurso administrativo pós-reprovação',badge:'soon',badgeTxt:'Em especificação',cost:'10 fichas por recurso',time:'A calibrar',soon:true,
      benefit:'Lê o parecer dos avaliadores, separa o que é recorrível do que não é, e redige o recurso administrativo dentro do prazo — reprovação deixa de ser ponto final.',
      does:['Lê e interpreta o parecer da banca avaliadora','Separa pontos recorríveis de pontos sem base para recurso','Redige a peça de recurso dentro do prazo fatal do edital'],
      nots:['Só faz sentido com uma reprovação registrada e o prazo de recurso ainda aberto','Sempre pede sua confirmação antes de considerar a peça entregue — o prazo é fatal'],
      hist:[],
      faq:[['O Rui garante a reversão da reprovação?','Não. Ele aumenta a qualidade e a chance do recurso, mas a decisão final é do órgão avaliador.'],['Por que preciso confirmar antes de "entregar"?','Porque o prazo de recurso é fatal — a confirmação evita que algo seja considerado enviado sem realmente ter sido.'],['Quando chega?','Em especificação. Clique em Avisar-me para ser notificado no lançamento.']]}
  ];
  if(isZeroMode)AGD.forEach(function(a){a.hist=[]}); /* conta nova: nenhum agente rodou ainda */
  function badgeHtml(a){
    var cls=a.badge==='on'?'on':a.badge==='beta'?'beta':'soon-b';
    return '<span class="badge '+cls+'">'+a.badgeTxt+'</span>';
  }
  function promoBadgeHtml(a){
    return promoAppliesTo(a.k)?'<span class="promo-badge">PROMO -'+PROMO.pct+'%</span>':'';
  }
  /* Custo base (número único) de cada agente — espelha o texto usado nos campos "cost"/"action" do AGD,
     para poder recalcular com desconto sem precisar reescrever cada string manualmente. */
  var AGD_BASECOST={iris:5,ada:20,aurora:15,mike:20,kai:10,carlito:5,banca:10,clara:20,eros:5,romeu:15,rui:10};
  var AGD_SUFFIX={iris:' por projeto',ada:' por projeto',aurora:' por projeto',mike:' por projeto',kai:' por projeto',carlito:' por checklist',banca:' por avaliação',clara:' por prestação',eros:' por busca',romeu:' por geração',rui:' por recurso'};
  /* HTML do custo exibido no card e no drawer (kstat "Custo"), já considerando a campanha ativa. */
  function agentCostHTML(a){
    if(a.k==='rico'){
      var lo=applyPromo('rico',1),hi=applyPromo('rico',3);
      if(!lo.discounted)return '1 a 3 fichas por rodada';
      return '<s class="promo-strike">1 a 3</s> <b class="promo-final">'+lo.final+' a '+hi.final+'</b> fichas por rodada <span class="promo-tag">-'+PROMO.pct+'%</span>';
    }
    var base=AGD_BASECOST[a.k];
    if(base==null)return a.cost;
    var html=costBadgeHTML(a.k,base,{suffix:AGD_SUFFIX[a.k]||''});
    if(a.k==='ada'){
      var ad=applyPromo('ada',5);
      html+=' · adaptação '+(ad.discounted?('<s class="promo-strike">5</s> <b class="promo-final">'+ad.final+'</b>'):'5');
    }
    return html;
  }
  /* HTML do botão de ação do card/drawer ("Elaborar projeto · a partir de 20 fichas"), preservando o
     texto original e só recalculando o número de fichas quando a campanha se aplica ao agente. */
  function agentActionHTML(a){
    if(!a.action)return '';
    if(a.k==='rico'){
      var lo=applyPromo('rico',1),hi=applyPromo('rico',3);
      if(!lo.discounted)return a.action;
      return a.action.replace('1 a 3 fichas','<s class="promo-strike">1 a 3</s> <b class="promo-final">'+lo.final+' a '+hi.final+'</b> fichas <span class="promo-tag">-'+PROMO.pct+'%</span>');
    }
    var base=AGD_BASECOST[a.k];
    if(base==null)return a.action;
    var r=applyPromo(a.k,base);
    if(!r.discounted)return a.action;
    return a.action.replace(String(base)+' fichas','<s class="promo-strike">'+r.orig+'</s> <b class="promo-final">'+r.final+'</b> fichas <span class="promo-tag">-'+PROMO.pct+'%</span>');
  }
  var agGrid=$('#agentsGrid');
  agGrid.innerHTML=AGD.map(function(a,i){
    var actBtn=a.soon
      ? '<button class="btn-ghost" data-toast="Anotado! Vamos te avisar quando '+a.name+' for lançado. (demo)" style="width:100%;font-size:.76rem">🔔 Avisar-me quando chegar</button>'
      : '<button class="btn-primary" data-agent="'+a.k+'" style="width:100%;font-size:.78rem">'+agentActionHTML(a)+'</button>';
    var hist=a.hist.length
      ? '<div class="ag-hist"><small>Última atividade</small>'+a.hist[0].t+' <span class="hd">· '+a.hist[0].d+'</span></div>'
      : '<div class="ag-hist muted">Ainda sem atividades com você</div>';
    return '<article class="agent-big'+(a.soon?' soon':'')+(a.gate?' gate':'')+'" data-ag="'+i+'" style="--ac:var(--c-'+a.k+');animation-delay:'+(0.03+i*0.04)+'s" tabindex="0" role="button" aria-label="Ver detalhes de '+a.name+'">'+
      '<div class="agent-head"><svg class="av" aria-hidden="true"><use href="'+avatarHref(a.k)+'"/></svg>'+
        '<div><div class="agent-name">'+a.name+'</div><div class="agent-role">'+a.role+'</div></div></div>'+
      '<div class="agent-badges">'+badgeHtml(a)+promoBadgeHtml(a)+'</div>'+
      '<p class="ag-benefit">'+a.benefit+'</p>'+
      hist+
      '<span class="agent-cost"><span class="ficha-coin" aria-hidden="true">M</span>'+agentCostHTML(a)+'</span>'+
      actBtn+
      '<button class="ag-more">Detalhes completos →</button>'+
    '</article>';
  }).join('');

  /* "N ativos, M a caminho" calculado a partir do catálogo real (AGD), não
     digitado — fonte única do número de agentes vive em
     06-regras-e-especificacao-dev.md §2.2; aqui só refletimos o catálogo,
     nunca hardcodar essa contagem de novo (ver nota na §2.2). */
  var agentesPageSub=$('#agentesPageSub');
  if(agentesPageSub){
    var agAtivos=AGD.filter(function(a){return !a.soon}).length;
    var agCaminho=AGD.length-agAtivos;
    agentesPageSub.textContent='Sua equipe de IA trabalhando pela sua captação, '+agAtivos+' ativos e '+agCaminho+' a caminho';
  }

  var agDrawer=$('#agDrawer'),agScrim=$('#agScrim'),agInner=$('#agDrawerInner');
  function closeDrawer(){agDrawer.classList.remove('open');agScrim.classList.remove('show')}
  function openDrawer(i){
    var a=AGD[i];
    var histHtml=a.hist.length
      ? a.hist.map(function(hh){return '<div class="dhist-item"><b>'+hh.d+'</b><span>'+hh.t+'</span><button class="t-view">Ver resultado</button></div>'}).join('')
      : '<p style="font-size:.76rem;color:var(--text-3);font-style:italic">Nenhuma atividade ainda. Rode '+a.name+' pela primeira vez e o histórico aparece aqui.</p>';
    agInner.innerHTML=
      '<div class="drawer-head">'+
        '<svg class="av" aria-hidden="true"><use href="'+avatarHref(a.k)+'"/></svg>'+
        '<div><h3>'+a.name+'</h3><div class="drole">'+a.role+'</div><div style="margin-top:.3rem">'+badgeHtml(a)+promoBadgeHtml(a)+'</div></div>'+
        '<button class="drawer-close" id="dClose" aria-label="Fechar painel">✕</button>'+
      '</div>'+
      '<div class="drawer-body">'+
        '<div class="dsec"><p style="font-size:.86rem;color:var(--text);font-weight:600;line-height:1.55">'+a.benefit+'</p></div>'+
        (a.warn?'<div class="dsec"><div class="dwarn"><b>Revisão humana obrigatória.</b> Todo projeto elaborado pela Ada passa por revisão antes da submissão. A MonyU não garante aprovação em editais via self-service.</div></div>':'')+
        '<div class="key-stats" style="grid-template-columns:1fr 1fr;margin-bottom:1.15rem">'+
          '<div class="kstat"><small>Custo</small><b>'+agentCostHTML(a)+'</b></div>'+
          '<div class="kstat"><small>Tempo médio</small><b>'+a.time+'</b></div>'+
        '</div>'+
        '<div class="dsec"><h4>O que '+(a.k==='banca'?'a banca faz':a.name+' faz')+' por você</h4><ul class="yes">'+a.does.map(function(d){return '<li>'+d+'</li>'}).join('')+'</ul></div>'+
        (a.nots.length?'<div class="dsec"><h4>O que fica fora (expectativa alinhada)</h4><ul class="no">'+a.nots.map(function(d){return '<li>'+d+'</li>'}).join('')+'</ul></div>':'')+
        '<div class="dsec"><h4>Histórico com você</h4><div class="dhist">'+histHtml+'</div></div>'+
        sourcesSec(a)+relSec(a)+autonomySec(a)+
        '<div class="dsec dfaq"><h4>Perguntas frequentes</h4>'+
          a.faq.map(function(f){return '<details><summary>'+f[0]+'</summary><p>'+f[1]+'</p></details>'}).join('')+
        '</div>'+
      '</div>'+
      '<div class="drawer-foot">'+
        (a.soon
          ? '<button class="btn-ghost" data-toast="Anotado! Vamos te avisar quando '+a.name+' for lançado. (demo)">🔔 Avisar-me quando chegar</button>'
          : '<button class="btn-primary" data-agent="'+a.k+'">'+agentActionHTML(a)+'</button>'+
            '<button class="btn-ghost" data-toast="Exemplo de resultado de '+a.name+' — em breve no piloto (demo)">Ver exemplo de resultado</button>')+
      '</div>';
    agDrawer.classList.add('open');agScrim.classList.add('show');
    agInner.querySelector('#dClose').addEventListener('click',closeDrawer);
    agInner.querySelectorAll('.t-view').forEach(function(b){
      b.addEventListener('click',function(){
        if(a.k==='ada'){closeDrawer();openWs()}
        else{toast('Abrindo o resultado — visualização completa em breve no piloto (demo)')}
      });
    });
    agInner.querySelectorAll('[data-aut]').forEach(function(b){
      function setLvl(){
        var lvl=parseInt(b.getAttribute('data-aut'),10);
        if(lvl>=3&&!AUT_BUDGET[a.k])AUT_BUDGET[a.k]=10;
        AUT_LVL[a.k]=lvl;
        toast(a.name+' agora em modo '+AUT_NAMES[lvl]+(lvl>=3?' — teto de '+(AUT_BUDGET[a.k]||10)+' fichas/mês':'')+'. Você pode voltar ao Guiado a qualquer momento. (demo)');
        openDrawer(i);
      }
      b.addEventListener('click',setLvl);
      b.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();setLvl()}});
    });
    var pbtn=agInner.querySelector('[data-pause]');
    if(pbtn){pbtn.addEventListener('click',function(){
      AUT_LVL[a.k]=1;
      toast(a.name+' pausado — de volta ao modo Guiado. Nada roda sem você. (demo)');
      openDrawer(i);
    })}
    var wt=agInner.querySelector('[data-webtoggle]');
    if(wt){wt.addEventListener('change',function(){
      if(!wt.checked){
        wt.checked=true;
        webPendKey=a.k;webPendIdx=i;
        $('#webAgent1').textContent=a.name;
        $('#webAgent2').textContent=a.name;
        open($('#webModal'));
      }else{
        WEB_ON[a.k]=true;
        toast('Busca na web reativada para '+a.name+'.');
        openDrawer(i);
      }
    })}
    var bsel=agInner.querySelector('.aut-budget select');
    if(bsel){bsel.addEventListener('change',function(){
      AUT_BUDGET[a.k]=parseInt(bsel.value,10);
      toast('Teto de autonomia de '+a.name+': '+bsel.value+' fichas/mês. (demo)');
    })}
  }
  agScrim.addEventListener('click',closeDrawer);
  document.addEventListener('click',function(e){
    var card=e.target.closest('[data-ag]');
    if(!card)return;
    if(e.target.closest('.ag-more')){openDrawer(parseInt(card.getAttribute('data-ag'),10));return}
    if(e.target.closest('button,a'))return;
    openDrawer(parseInt(card.getAttribute('data-ag'),10));
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape')closeDrawer();
    var card=e.target.closest?e.target.closest('[data-ag]'):null;
    if(card&&(e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();openDrawer(parseInt(card.getAttribute('data-ag'),10))}
  });

  /* ================= Módulos em breve ================= */
  var SOONMOD={
    giga:{name:'GigaMonyU',eta:'Previsto para out–dez/2026',
      icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 15.2c1.7.7 2.7 2.2 3 4.8"/></svg>',
      desc:'O ecossistema de prestadores da MonyU: um marketplace que conecta o seu projeto a consultores, pesquisadores e ICTs verificados — sem que você precise procurar fora da plataforma.',
      items:['Vitrine de prestadores com histórico e avaliações','Matching automático com o seu projeto (via Eros)','Contratação e comunicação sempre dentro da plataforma']},
    trein:{name:'Treinamentos',eta:'Previsto para o 4º trimestre de 2026',
      icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 2 9l10 5 10-5-10-5z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/></svg>',
      desc:'Trilhas práticas de capacitação para você dominar a captação de recursos: como funcionam os editais, o que os avaliadores esperam e como extrair o máximo de cada agente.',
      items:['Trilhas por nível: do primeiro edital à captação recorrente','Aulas curtas com casos reais de projetos aprovados','Certificado MonyU ao concluir cada trilha']},
    banca:{name:'A Banca',eta:'Previsto para nov/2026',
      icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M5 6h14M7 6l-3 6a3.5 3.5 0 0 0 7 0L8 6M17 6l-3 6a3.5 3.5 0 0 0 7 0l-3-6M12 6v13M8 21h8"/></svg>',
      desc:'Uma banca de avaliadores simulados, treinada nos critérios reais de cada edital, dá nota no seu projeto antes da banca oficial — para você submeter só quando estiver forte.',
      items:['Nota por quesito, no padrão do edital escolhido','Parecer detalhado com pontos fracos priorizados','Reavaliação após ajustes para medir a evolução']}
  };
  var soonKey='';
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-soonmod]');
    if(!t)return;
    e.preventDefault();
    soonKey=t.getAttribute('data-soonmod');
    var m=SOONMOD[soonKey];
    $('#soonName').textContent=m.name;
    $('#soonIcon').innerHTML=m.icon;
    $('#soonEta').textContent=m.eta;
    $('#soonDesc').textContent=m.desc;
    $('#soonList').innerHTML=m.items.map(function(it){
      return '<li style="font-size:.78rem;color:var(--text-2);line-height:1.45;padding-left:1.15rem;position:relative"><span style="position:absolute;left:0;color:var(--ok-text);font-weight:800;font-size:.72rem">✓</span>'+it+'</li>';
    }).join('');
    open($('#soonModal'));
  });
  $('#soonSubscribe').addEventListener('click',function(){
    close($('#soonModal'));
    toast('Pronto! Você será avisado assim que '+SOONMOD[soonKey].name+' for lançado. (demo)');
  });

  /* ================= Resolver saldo (padrão único) ================= */
  window.__monyuTelemetry=window.__monyuTelemetry||[];
  function track(ev,data){window.__monyuTelemetry.push({t:new Date().toISOString(),ev:ev,data:data||{}})}
  var rsPack=10,rsPrice=35,rsOnResolved=null,sessionBuys=0;
  function resolverSaldo(gap,hint,onResolved){
    rsOnResolved=onResolved||null;
    rsPack=[10,25,50,100].filter(function(q){return q>=gap})[0]||100;
    rsPrice=rsPack*3.5;
    $('#rsGap').textContent=gap;
    $('#rsPlural').textContent=gap>1?'m':'';
    $('#rsPlural2').textContent=gap>1?'s':'';
    $('#rsPackQty').textContent=rsPack;
    $('#rsPackPrice').textContent=rsPrice.toFixed(2).replace('.',',');
    $('#rsPackLeft').textContent=rsPack-gap;
    $('#rsUpsell').style.display=(sessionBuys>=1||gap>20)?'':'none';
    $('#rsHint').textContent=(hint?hint+' ':'')+'Suas 80 fichas do plano renovam em 12 dias.';
    open($('#saldoModal'));
    track('resolver_saldo_aberto',{gap:gap,pack:rsPack});
  }
  $('#rsBuy').addEventListener('click',function(){
    saldo+=rsPack;sessionBuys++;syncSaldo();
    close($('#saldoModal'));
    toast(rsPack+' fichas adicionadas — pagamento simulado. Sua ação está pronta para confirmar. (demo)');
    track('resolver_saldo_compra',{pack:rsPack});
    if(rsOnResolved)rsOnResolved();
  });
  $('#rsMore').addEventListener('click',function(){close($('#saldoModal'));track('resolver_saldo_outros',{});openBuy()});
  $('#rsPlans').addEventListener('click',function(){close($('#saldoModal'));track('resolver_saldo_planos',{});openPlans()});
  $('#rsBack').addEventListener('click',function(){close($('#saldoModal'));track('resolver_saldo_ajustar',{})});

  function sourcesSec(a){
    if(a.soon)return '';
    return '<div class="dsec"><h4>Fontes de pesquisa</h4>'+
      '<div class="src-row"><span>📚 Núcleo MonyU — editais, jurisprudência e templates validados</span><b>sempre ativo</b></div>'+
      '<div class="src-row"><span>🗂 Seu Memória — global + projeto do contexto</span><b>sempre ativo</b></div>'+
      '<div class="src-row"><span>🌐 Busca na web — dados de mercado e evidências atualizadas</span>'+
        '<span class="switch"><input type="checkbox" data-webtoggle'+(WEB_ON[a.k]?' checked':'')+' aria-label="Busca na web para '+a.name+'"><span class="track-sw"></span><span class="thumb"></span></span>'+
      '</div>'+
      (WEB_ON[a.k]===false?'<p class="src-warn">⚠ Web desativada: '+a.name+' usa apenas o Núcleo MonyU e a sua Memória — nada sai do perímetro.</p>':'')+
    '</div>';
  }
  var webPendKey='',webPendIdx=-1;

  /* ================= Autonomia (escada N1–N4) ================= */
  var AUT_NAMES={1:'Guiado',2:'Assistido',3:'Semi-automático',4:'Automático'};
  var AUT_DESC={1:'você inicia cada ação',2:'o agente recomenda, você aprova',3:'roda sozinho; pede aprovação acima do teto',4:'roda sozinho dentro do orçamento; avisa só quando importa'};
  var AUT_MAX={rico:4,iris:3,aurora:3,kai:3,ada:2,mike:3};
  var AUT_LVL={rico:2,iris:2,ada:1,aurora:1,kai:1,mike:1};
  var AUT_BUDGET={rico:10,iris:20};
  function autonomySec(a){
    if(a.soon)return '<div class="dsec"><h4>Você no comando (autonomia)</h4><p style="font-size:.74rem;color:var(--text-3)">Os níveis de autonomia ficam disponíveis no lançamento do agente.</p></div>';
    var max=AUT_MAX[a.k]||2,cur=AUT_LVL[a.k]||1,rows='';
    for(var l=1;l<=4;l++){
      var locked=l>max,on=l===cur;
      rows+='<div class="aut-opt'+(on?' on':'')+(locked?' locked':'')+'"'+(locked?'':' data-aut="'+l+'" role="radio" tabindex="0" aria-checked="'+on+'"')+'>'+
        '<span class="aut-radio">'+(locked?'🔒':'')+'</span>'+
        '<span class="aut-info"><b>N'+l+' · '+AUT_NAMES[l]+(on?'<i class="aut-live">ativo</i>':'')+'</b>'+
        '<span>'+(locked?(a.k==='ada'?'Bloqueado: a revisão humana da Ada é sempre obrigatória':'Libera conforme '+a.name+' acumula execuções bem-sucedidas com você'):AUT_DESC[l])+'</span></span>'+
      '</div>';
    }
    var budget=cur>=3?'<div class="aut-budget">Teto de consumo autônomo: <select><option'+(AUT_BUDGET[a.k]===10?' selected':'')+'>10</option><option'+(AUT_BUDGET[a.k]===20?' selected':'')+'>20</option><option'+(AUT_BUDGET[a.k]===40?' selected':'')+'>40</option></select> fichas/mês · acima disso, '+a.name+' pede a sua aprovação</div>':'';
    var pause=cur>1?'<button class="btn-ghost" data-pause style="width:100%;font-size:.74rem">⏸ Pausar tudo e voltar ao Guiado</button>':'';
    return '<div class="dsec"><h4>Você no comando (autonomia)</h4><div class="aut-box">'+rows+budget+pause+
      '<p class="aut-note"><span aria-hidden="true">🛡</span> O controle é sempre seu: mude de nível ou pause com um clique — nada roda fora do que você autorizar.</p></div></div>';
  }

  /* ================= Workspace de revisão (Ada) ================= */
  var WS_SECS=[
    {t:'1. Qualificação da proponente',lim:2000,st:'valid',
     tx:'Sua empresa é uma organização de base tecnológica com histórico consistente de atuação no seu setor, equipe técnica qualificada e capacidade comprovada de execução. A estrutura societária, a regularidade fiscal e trabalhista e o corpo técnico atendem aos critérios de elegibilidade previstos no edital selecionado para o projeto {{PROJETO}}.'},
    {t:'2. Caracterização do problema e oportunidade',lim:3000,st:'valid',
     tx:'O projeto {{PROJETO}} parte de um problema real e mensurável identificado no mercado de atuação da empresa, com evidências de demanda e potencial de escala. A ausência de uma solução madura e acessível para esse problema representa uma janela de oportunidade relevante, especialmente diante das tendências regulatórias e tecnológicas do setor.'},
    {t:'3. Objetivos geral e específicos',lim:1500,st:'valid',
     tx:'Objetivo geral: desenvolver e validar, em ambiente real, a solução proposta pelo projeto {{PROJETO}}. Específicos: (i) elevar o nível de maturidade tecnológica (TRL) da solução; (ii) validar o modelo de negócio associado; (iii) testar a solução com usuários ou clientes-piloto; (iv) consolidar evidências técnicas e de mercado para o escalonamento.'},
    {t:'4. Metodologia e plano de trabalho',lim:5000,st:'valid',
     tx:'O projeto {{PROJETO}} será executado em fases estruturadas, com marcos técnicos e financeiros auditáveis: planejamento e especificação técnica; desenvolvimento e testes controlados; validação em ambiente operacional; e consolidação de resultados com plano de continuidade. A gestão seguirá boas práticas de acompanhamento de projetos de PD&I, com entregas parciais verificáveis pelo financiador.'},
    {t:'5. Resultados esperados e impactos',lim:2500,st:'valid',
     tx:'Espera-se que o projeto {{PROJETO}} gere ganhos mensuráveis de eficiência, redução de custos ou geração de receita para o setor de atuação da empresa, além de contribuir para a geração de empregos qualificados e, quando aplicável, propriedade intelectual. Os impactos econômicos, sociais e/ou ambientais serão quantificados conforme os indicadores exigidos pelo edital.'},
    {t:'6. Equipe executora',lim:2000,st:'valid',
     tx:'A equipe executora do projeto {{PROJETO}} reúne profissionais com formação e experiência compatíveis com a complexidade técnica proposta, incluindo liderança técnica qualificada e colaboradores dedicados às frentes de desenvolvimento, validação e gestão. A dedicação da coordenação e da equipe ao projeto atende aos requisitos mínimos do edital.'},
    {t:'7. Cronograma físico-financeiro',lim:2000,st:'draft',
     tx:'A Ada está elaborando esta seção com base no plano de trabalho do projeto {{PROJETO}} e no padrão exigido pelo formulário do edital selecionado. Previsão: hoje às 16h.'},
    {t:'8. Orçamento e contrapartida',lim:2000,st:'draft',
     tx:'A Ada está elaborando esta seção. Ela usará os documentos financeiros da sua Memória global para compor a contrapartida do projeto {{PROJETO}}. Previsão: hoje às 16h.'}
  ];
  var ws=$('#ws'),wsMain=$('#wsMain'),wsDirty=false,wsCopiedSet={};
  /* Substitui o token {{PROJETO}} pelo nome real do projeto (cadastrado pelo cliente) —
     roda 1x no boot (demo populada, usa o nome do p1) ou 1x na criação do projeto (modo
     conta nova). Depois disso ressincroniza .orig/.stOrig para o fluxo de edição/revert
     já existente do workspace continuar funcionando normalmente. */
  function wsApplyProjName(name){
    WS_SECS.forEach(function(s){s.tx=s.tx.split('{{PROJETO}}').join(name);s.orig=s.tx;s.stOrig=s.st});
  }
  if(!isZeroMode)wsApplyProjName(PROJECTS.p1.name);
  /* Modo conta nova: o token só é substituído quando o cliente cadastra o projeto
     (ver #npSave) — antes disso não há como abrir o workspace da Ada (nenhum projeto existe). */
  WS_SECS.forEach(function(s){if(s.orig===undefined){s.orig=s.tx;s.stOrig=s.st}});
  function wsBadge(s){
    if(s.st==='valid')return '<span class="ws-badge ok">✓ Validado pela Ada</span>';
    if(s.st==='edited')return '<span class="ws-badge warn">⚠ Editado — não validado (Ada e A Banca)</span>';
    return '<span class="ws-badge draft-b">⏳ Em elaboração pela Ada</span>';
  }
  function renderWs(){
    wsMain.innerHTML=WS_SECS.map(function(s,i){
      var ready=s.st!=='draft';
      return '<section class="ws-sec '+(s.st==='edited'?'edited':'')+(s.st==='draft'?'draft':'')+'" data-wsi="'+i+'">'+
        '<div class="ws-sec-head"><b>'+s.t+'</b>'+wsBadge(s)+'</div>'+
        '<div class="ws-text"'+(s.st==='draft'?' style="font-style:italic;color:var(--text-3)"':'')+'></div>'+
        '<div class="ws-sec-foot">'+
          (ready?'<button class="ws-copy'+(wsCopiedSet[i]?' copied':'')+'" data-copy="'+i+'">'+(wsCopiedSet[i]?'✓ Copiado':'Copiar seção')+'</button>'+
                 '<button class="ws-edit" data-edit="'+i+'">Editar</button>'
                :'<button class="ws-copy" disabled>Copiar seção</button>')+
          '<span class="ws-chars'+(s.tx.length>s.lim?' over':'')+'">'+s.tx.length.toLocaleString('pt-BR')+' / '+s.lim.toLocaleString('pt-BR')+' caracteres</span>'+
        '</div>'+
      '</section>';
    }).join('');
    wsMain.querySelectorAll('.ws-sec').forEach(function(el,i){
      el.querySelector('.ws-text').textContent=WS_SECS[i].tx;
    });
    var n=Object.keys(wsCopiedSet).length;
    $('#wsCopied').textContent=n+' de 6 seções copiadas'+(n===6?' 🎉':'');
    if(n===6&&store.get('rw-ws6-done','')!=='1'){
      store.set('rw-ws6-done','1');
      if(typeof rwCntInc==='function'){rwCntInc('submissionready');rwRecalcAll()}
    }
    var edited=WS_SECS.filter(function(s){return s.st==='edited'}).length;
    $('#wsAdaStatus').textContent=(6-edited)+' de 8 seções validadas'+(edited?' · '+edited+' editada(s) aguardando revalidação':'');
  }
  function copyText(txt,btn,i){
    function ok(){wsCopiedSet[i]=1;renderWs();toast('Seção copiada — cole no campo correspondente do formulário. (demo)')}
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok,function(){fallback()})}
    else fallback();
    function fallback(){
      var ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();
      try{document.execCommand('copy')}catch(e){}
      document.body.removeChild(ta);ok();
    }
  }
  wsMain.addEventListener('click',function(e){
    var cp=e.target.closest('[data-copy]');
    if(cp){var i=parseInt(cp.getAttribute('data-copy'),10);copyText(WS_SECS[i].tx,cp,i);return}
    var ed=e.target.closest('[data-edit]');
    if(ed){
      var i2=parseInt(ed.getAttribute('data-edit'),10),sec=ed.closest('.ws-sec'),s=WS_SECS[i2];
      var textDiv=sec.querySelector('.ws-text');
      var ta=document.createElement('textarea');ta.value=s.tx;
      textDiv.replaceWith(ta);ta.focus();
      ed.textContent='Concluir edição';ed.setAttribute('data-done',i2);ed.removeAttribute('data-edit');
      ta.addEventListener('input',function(){
        if(s.tx!==ta.value&&s.st!=='edited'){s.st='edited';wsDirty=true;
          sec.classList.add('edited');
          sec.querySelector('.ws-badge').outerHTML=wsBadge(s);
        }
        s.tx=ta.value;
        var ch=sec.querySelector('.ws-chars');
        ch.textContent=ta.value.length.toLocaleString('pt-BR')+' / '+s.lim.toLocaleString('pt-BR')+' caracteres';
        ch.classList.toggle('over',ta.value.length>s.lim);
      });
      return;
    }
    var dn=e.target.closest('[data-done]');
    if(dn){renderWs()}
  });
  function openWs(){wsDirty=false;renderWs();ws.classList.add('open');document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden'}
  function closeWs(){ws.classList.remove('open');document.body.style.overflow='';document.documentElement.style.overflow=''}
  function attemptCloseWs(){
    if(wsDirty){open($('#wsExitModal'))}
    else closeWs();
  }
  $('#wsClose').addEventListener('click',attemptCloseWs);
  $('#wsExitSave').addEventListener('click',function(){
    WS_SECS.forEach(function(s){s.orig=s.tx;s.stOrig=s.st});
    wsDirty=false;
    close($('#wsExitModal'));closeWs();
    toast('Alterações salvas no projeto. Dica: peça à Ada a revalidação das seções editadas antes de submeter. (demo)');
  });
  $('#wsExitDiscard').addEventListener('click',function(){
    WS_SECS.forEach(function(s){s.tx=s.orig;s.st=s.stOrig});
    wsDirty=false;
    close($('#wsExitModal'));closeWs();
    toast('Alterações descartadas — o projeto mantém a última versão validada.');
  });
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-ws]');
    if(t)openWs();
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&ws.classList.contains('open')&&!$('#wsExitModal').classList.contains('open')){attemptCloseWs()}
  });

  /* ================= Memória (pastas + documentos) ================= */
  var DOCS=[
    {n:'Apresentação institucional NovaTech 2026',type:'Pitch deck',orig:'Google Drive',date:'20 jun',use:'Ada 6×',proj:null},
    {n:'Demonstrativos financeiros 2024–2025',type:'Orçamento',orig:'Google Drive',date:'20 jun',use:'Íris 3×',proj:null},
    {n:'Certidões e atos constitutivos',type:'Outro',orig:'upload',date:'22 jun',use:'—',proj:null},
    {n:'Currículos da equipe técnica',type:'Outro',orig:'Google Drive',date:'28 jun',use:'Ada 4×',proj:null},
    {n:'Portfólio de projetos aprovados',type:'Outro',orig:'upload',date:'22 jun',use:'Ada 2×',proj:null},
    {n:'Memorial técnico — microrredes',type:'Projeto completo',orig:'Google Drive',date:'23 jun',use:'Ada 5×',proj:'p1'},
    {n:'Dados de geração das usinas-piloto',type:'Outro',orig:'Google Drive',date:'23 jun',use:'Ada 3×',proj:'p1'},
    {n:'Orçamento detalhado do projeto',type:'Orçamento',orig:'upload',date:'25 jun',use:'—',proj:'p1'},
    {n:'Cartas de apoio institucional',type:'Outro',orig:'upload',date:'25 jun',use:'Ada 1×',proj:'p1'},
    {n:'Artigo científico de referência',type:'Outro',orig:'Google Drive',date:'26 jun',use:'Ada 2×',proj:'p1'},
    {n:'Especificação da plataforma IoT',type:'Projeto completo',orig:'Google Drive',date:'28 jun',use:'Íris 1×',proj:'p2'},
    {n:'Resultados do piloto (12 meses)',type:'Outro',orig:'upload',date:'28 jun',use:'Íris 1×',proj:'p2'},
    {n:'Projeto CNPq — versão submetida',type:'Projeto completo',orig:'upload',date:'12 jun',use:'—',proj:'p3'},
    {n:'Protocolo de submissão CNPq',type:'Outro',orig:'upload',date:'12 jun',use:'—',proj:'p3'}
  ];
  if(isZeroMode)DOCS.length=0; /* conta nova: Memória começa vazio, nada foi indexado ainda */
  var KB_LIMIT=50,kbCur='global';
  function kbFolderName(k){return k==='global'?'Global da empresa':(PROJECTS[k]?PROJECTS[k].name:k)}
  function kbAvatarFor(k){return k==='p1'?'ada':k==='p2'?'iris':k==='p3'?'banca':'rico'}
  function renderKb(){
    if(!$('#kbFolders'))return;
    var folders='<button class="kb-folder'+(kbCur==='global'?' on':'')+'" data-kb="global"><span class="glob" aria-hidden="true">🌐</span>Global da empresa<span class="cnt">'+globalDocsCount()+'</span></button>';
    Object.keys(PROJECTS).forEach(function(pid){
      folders+='<button class="kb-folder'+(kbCur===pid?' on':'')+'" data-kb="'+pid+'">'+
        '<svg class="av" aria-hidden="true"><use href="#av-'+kbAvatarFor(pid)+'"/></svg>'+
        '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+PROJECTS[pid].name+'</span>'+
        '<span class="cnt">'+projDocsCount(pid)+'</span></button>';
    });
    $('#kbFolders').innerHTML=folders;
    $('#kbUsageTxt').textContent=DOCS.length+' de '+KB_LIMIT+' docs · plano Starter';
    $('#kbUsageBar').style.width=Math.min(100,Math.round(DOCS.length/KB_LIMIT*100))+'%';
    renderKbPanel();
  }
  function kbRow(d,inherited){
    var ext=d.n.indexOf('.pdf')>-1?'PDF':d.n.indexOf('.png')>-1?'IMG':d.n.indexOf('.docx')>-1?'DOC':'DOC';
    var idx=DOCS.indexOf(d);
    var isExternal=d.orig!=='upload';
    var dlBtn=isExternal
      ? '<a class="kb-act kb-dl" href="#" data-kbopen="'+idx+'" data-tip="Abrir no '+d.orig+' — o arquivo não fica no nosso servidor" aria-label="Abrir no '+d.orig+'">↗ abrir</a>'
      : '<button class="kb-act kb-dl" data-kbdownload="'+idx+'" data-tip="Baixar uma cópia deste documento" aria-label="Baixar documento">⬇ baixar</button>';
    var scopeCtrl='';
    if(!inherited){
      scopeCtrl=d.proj
        ? '<label class="switch kb-scope-switch" data-tip="Tornar acessível a todos os agentes e projetos"><input type="checkbox" data-kbglob="'+idx+'"><span class="track-sw"></span><span class="thumb"></span></label>'
        : '<select class="kb-scope-move" data-kbmove="'+idx+'" data-tip="Tornar exclusivo de um projeto" aria-label="Mover documento para um projeto">'+
          '<option value="">🌐 Global (todos)</option>'+
          Object.keys(PROJECTS).map(function(pid){return '<option value="'+pid+'">'+PROJECTS[pid].name+'</option>'}).join('')+
          '</select>';
    }
    return '<div class="kb-row">'+
      '<span class="kd-ico">'+ext+'</span>'+
      '<span class="kd-name"><b>'+d.n+'</b><span>'+d.orig+' · indexado em '+d.date+' · uso: '+d.use+'</span></span>'+
      '<span class="kb-type">'+d.type+'</span>'+
      '<span class="kb-scope '+(d.proj?'proj':'glob')+'">'+(d.proj?'Projeto':'🌐 Global')+'</span>'+
      dlBtn+
      (inherited?'':scopeCtrl+'<button class="kb-act mut" data-kbdel="'+idx+'" data-tip="Remove só o índice — o arquivo continua na sua origem">remover</button>')+
    '</div>';
  }
  function renderKbPanel(){
    var q=($('#kbSearch').value||'').toLowerCase();
    var own=DOCS.filter(function(d){return (kbCur==='global'?!d.proj:d.proj===kbCur)&&(d.n+' '+d.type).toLowerCase().indexOf(q)>-1});
    $('#kbCrumbName').textContent=kbFolderName(kbCur);
    $('#kbCrumbCount').textContent='· '+own.length+' documento(s)';
    $('#kbDocsList').innerHTML=own.map(function(d){return kbRow(d,false)}).join('');
    var inh=$('#kbInherited');
    if(kbCur!=='global'){
      var globs=DOCS.filter(function(d){return !d.proj});
      inh.style.display='';
      $('#kbInhCount').textContent=globs.length;
      $('#kbInhList').innerHTML=globs.map(function(d){return kbRow(d,true)}).join('');
    }else{inh.style.display='none'}
    $('#kbEmpty').style.display=(own.length===0&&!q&&kbCur!=='global')?'':'none';
  }
  document.addEventListener('click',function(e){
    var f=e.target.closest('[data-kb]');
    if(f){kbCur=f.getAttribute('data-kb');$('#kbSearch').value='';renderKb();return}
    var g=e.target.closest('[data-kbglob]');
    if(g){
      DOCS[parseInt(g.getAttribute('data-kbglob'),10)].proj=null;
      toast('Documento promovido a Global — acessível a todos os agentes e projetos.');
      renderKb();return;
    }
    var op=e.target.closest('[data-kbopen]');
    if(op){
      e.preventDefault();
      var od=DOCS[parseInt(op.getAttribute('data-kbopen'),10)];
      toast('Abrindo "'+od.n+'" no '+od.orig+', em uma nova aba. (demo)');
      return;
    }
    var dw=e.target.closest('[data-kbdownload]');
    if(dw){
      var wd=DOCS[parseInt(dw.getAttribute('data-kbdownload'),10)];
      toast('Download de "'+wd.n+'" iniciado. (demo)');
      return;
    }
    var dl=e.target.closest('[data-kbdel]');
    if(dl){
      var d=DOCS.splice(parseInt(dl.getAttribute('data-kbdel'),10),1)[0];
      toast('"'+d.n+'" removido do índice. O arquivo original continua na sua nuvem/origem.');
      renderKb();syncNavBadges();
    }
  });
  document.addEventListener('change',function(e){
    var mv=e.target.closest('[data-kbmove]');
    if(mv){
      var midx=parseInt(mv.getAttribute('data-kbmove'),10);
      var mpid=mv.value;
      DOCS[midx].proj=mpid||null;
      toast(mpid?('Documento movido para "'+PROJECTS[mpid].name+'".'):'Documento mantido como Global.');
      renderKb();
    }
  });
  $('#kbSearch').addEventListener('input',renderKbPanel);
  function openKbModal(){
    $('#kbDest').value=kbCur==='global'?'g':kbCur;
    open($('#kbModal'));
  }
  $('#btnKbAdd').addEventListener('click',openKbModal);
  $('#kbAddHere').addEventListener('click',openKbModal);
  $('#kbEmptyAdd').addEventListener('click',openKbModal);
  $('#kbDrop').addEventListener('click',function(){toast('Seleção de arquivos simulada — 2 documentos na fila de indexação. (demo)')});
  $('#kbConfirm').addEventListener('click',function(){
    if(saldo<1){resolverSaldo(1,'A indexação custa 1 ficha por lote de até 20 páginas.',null);return}
    var v=$('#kbDest').value;
    saldo=Math.max(0,saldo-1);syncSaldo();
    DOCS.push({n:'Documento_novo.pdf',type:'Outro',orig:'upload',date:'06 jul',use:'—',proj:v==='g'?null:v});
    renderKb();syncNavBadges();
    close($('#kbModal'));
    toast('Documento em indexação para "'+kbFolderName(v==='g'?'global':v)+'" — 1 ficha. Os agentes já podem consultá-lo. (demo)');
  });
  renderKb();

  /* ================= Você sabia? + cruzamento entre agentes ================= */
  function agLink(k,label){
    return '<button class="ag-link" data-agkey="'+k+'" style="--alc:var(--c-'+k+')"><svg class="av" aria-hidden="true"><use href="'+avatarHref(k)+'"/></svg>'+label+'</button>';
  }
  var TIPS=[
    'A '+agLink('aurora','Aurora')+' descobre onde jogar; o '+agLink('kai','Kai')+' testa o problema-solução; e o '+agLink('barto','Bartô')+' confronta a viabilidade antes de você comprometer capital, contrapartida ou reputação. Três decisões diferentes, conectadas na mesma jornada.',
    'A '+agLink('ada','Ada')+' escreve bons projetos mesmo com poucas informações. Mas quando o '+agLink('kai','Kai')+' investiga o problema a fundo e a '+agLink('aurora','Aurora')+' mapeia mercado, tendências e a tese de captação, o seu projeto chega à banca com as evidências que os avaliadores procuram. Experimente combinar os três.',
    agLink('banca','A Banca')+' não é um agente — é um conselho. Avaliadores simulados, com perfis e critérios diferentes, analisam o seu projeto como numa banca real: apontam pontos fortes e fracos e entregam recomendações práticas para aumentar as suas chances de aprovação.',
    'O '+agLink('rico','Rico')+' encontra as oportunidades; a '+agLink('iris','Íris')+' diz se vale a pena competir por elas. Juntos custam 6 fichas — muito menos do que semanas de trabalho investidas no edital errado.',
    'Os agentes ficam mais inteligentes com você: cada documento adicionado ao <button class="ag-link" data-nav="conhecimento">Memória</button> melhora os textos da '+agLink('ada','Ada')+' e a precisão da '+agLink('iris','Íris')+'. E o contexto de um projeto nunca se mistura com o de outro.',
    'Um projeto 100% elaborado na plataforma pode ser adaptado para outro edital pela '+agLink('ada','Ada')+' por apenas 5 fichas — bem menos que a elaboração completa. Um bom projeto pode render mais de uma captação.',
    'Você presta serviços de captação — ou conhece quem preste? Consultores, pesquisadores, ICTs e squads entram na vitrine do <button class="ag-link" data-nav="giga">GigaMonyU</button>, recebem conexões qualificadas e ganham até 30% de desconto nos planos da MonyU. Membros em Destaque aparecem primeiro.'
  ];
  var dyIdx=Math.floor(Math.random()*TIPS.length);
  var dyHidden=store.get('didyou-hide','')===new Date().toDateString();
  function renderDy(){
    $$('.didyou-slot').forEach(function(slot){
      if(dyHidden){slot.innerHTML='';return}
      slot.innerHTML='<aside class="didyou">'+
        '<span class="dy-bulb" aria-hidden="true">💡</span>'+
        '<span class="dy-body"><b>Você sabia?</b><p>'+TIPS[dyIdx]+'</p></span>'+
        '<span class="dy-ctrl">'+
          '<button data-dy="prev" aria-label="Dica anterior">‹</button>'+
          '<span class="dy-dots">'+(dyIdx+1)+'/'+TIPS.length+'</span>'+
          '<button data-dy="next" aria-label="Próxima dica">›</button>'+
          '<button data-dy="hide" aria-label="Ocultar dicas por hoje" data-tip="Ocultar por hoje">✕</button>'+
        '</span>'+
      '</aside>';
    });
  }
  renderDy();
  document.addEventListener('click',function(e){
    var d=e.target.closest('[data-dy]');
    if(d){
      var act=d.getAttribute('data-dy');
      if(act==='next')dyIdx=(dyIdx+1)%TIPS.length;
      else if(act==='prev')dyIdx=(dyIdx-1+TIPS.length)%TIPS.length;
      else if(act==='hide'){dyHidden=true;store.set('didyou-hide',new Date().toDateString());toast('Dicas ocultadas por hoje. Elas voltam amanhã, discretas como sempre.')}
      renderDy();return;
    }
    var al=e.target.closest('[data-agkey]');
    if(al){
      var key=al.getAttribute('data-agkey');
      var idx=-1;
      AGD.forEach(function(x,ii){if(x.k===key)idx=ii});
      if(idx>-1)openDrawer(idx);
      return;
    }
    var rl=e.target.closest('[data-relk]');
    if(rl){
      var key2=rl.getAttribute('data-relk'),idx2=-1;
      AGD.forEach(function(x,ii){if(x.k===key2)idx2=ii});
      if(idx2>-1)openDrawer(idx2);
    }
  });
  var REL={
    rico:[{k:'iris',w:'diagnostica se a oportunidade encontrada vale a disputa'}],
    iris:[{k:'rico',w:'abastece você com oportunidades para diagnosticar'},{k:'barto',w:'assume quando a decisão exige viabilidade integrada'},{k:'ada',w:'elabora o projeto quando o diagnóstico aprova'}],
    ada:[{k:'kai',w:'investiga e valida o problema antes da escrita'},{k:'aurora',w:'traz mercado, tendências e tese de captação como evidências'},{k:'barto',w:'entrega condições de avanço e riscos antes da elaboração'},{k:'banca',w:'avalia o projeto pronto antes da submissão'}],
    aurora:[{k:'barto',w:'transforma a oportunidade priorizada em decisão de viabilidade'},{k:'ada',w:'transforma o discovery em projeto pronto para edital'},{k:'kai',w:'aprofunda o problema que o discovery revelou'}],
    kai:[{k:'barto',w:'integra o problema validado às demais dimensões do negócio'},{k:'ada',w:'escreve o projeto sobre a base que você validou'},{k:'aurora',w:'complementa com a visão de mercado e funding'}],
    barto:[{k:'aurora',w:'reabre alternativas quando a tese precisa pivotar'},{k:'kai',w:'valida hipóteses causais ainda frágeis'},{k:'ada',w:'recebe a tese quando a decisão é avançar ou avançar com condições'}],
    banca:[{k:'ada',w:'refina o projeto com base no parecer dos avaliadores'}],
    carlito:[{k:'ada',w:'com a documentação em dia, o projeto segue direto para a submissão'}],
    clara:[{k:'ada',w:'depois da aprovação, Clara presta contas do que a Ada ajudou a captar'}],
    eros:[{k:'ada',w:'executores certos fortalecem a equipe descrita no projeto'}]
  };
  function relSec(a){
    var rels=REL[a.k]||[];
    if(!rels.length)return '';
    return '<div class="dsec"><h4>Funciona melhor em conjunto</h4>'+
      rels.map(function(r){
        var other=null;AGD.forEach(function(x){if(x.k===r.k)other=x});
        return '<button class="rel-row" data-relk="'+r.k+'">'+
          '<svg class="av" aria-hidden="true"><use href="'+avatarHref(r.k)+'"/></svg>'+
          '<span style="flex:1;min-width:0"><b>'+other.name+(other.soon?' <span style="color:var(--text-3);font-weight:600;font-size:.6rem">· em breve</span>':'')+'</b>'+
          '<span>'+r.w+'</span></span>'+
          '<span class="rel-go" aria-hidden="true">›</span>'+
        '</button>';
      }).join('')+
    '</div>';
  }

  $('#webKeep').addEventListener('click',function(){close($('#webModal'))});
  $('#webOff').addEventListener('click',function(){
    WEB_ON[webPendKey]=false;
    close($('#webModal'));
    toast('Busca na web desativada para '+AG[webPendKey].name+'. Fontes: Núcleo MonyU + sua Memória.');
    if(webPendIdx>-1)openDrawer(webPendIdx);
  });

  /* ================= GigaMonyU (prévia) ================= */
  var PREST=[
    {ini:'MS',nome:'Consultora M.S.',loc:'Fortaleza-CE',cat:'consultor',tags:'Subvenção FINEP · Energia',stats:'<b>12 projetos aprovados</b> · R$ 8,4 mi captados',rating:'★ 4,9',dest:true,souser:true,resp:'responde em ~2h',
      bio:'Consultora sênior em engenharia de captação, especializada em subvenção econômica FINEP para o setor de energia. Atua da tese à submissão, em parceria com os agentes do SO.',
      port:['Subvenção FINEP · Energia solar · R$ 3,2 mi · 2025','FINEP Mais Inovação · Armazenamento · R$ 2,1 mi · 2024','FUNCAP Inovafit · IoT · R$ 480 mil · 2024'],
      rev:[['Conduziu nossa primeira captação com uma clareza que a gente não encontrou em lugar nenhum.','Proponente · biotec · mar/2026'],['Revisão cirúrgica do projeto que a Ada elaborou. Aprovamos na primeira.','Proponente · energia · jan/2026']]},
    {ini:'NL',nome:'ICT Nordeste Lab',loc:'Fortaleza-CE',cat:'pesquisador',tags:'Energia renovável · credenciada EMBRAPII',stats:'<b>23 projetos executados</b> · 4 laboratórios',rating:'★ 4,7',dest:true,souser:false,resp:'responde em ~1 dia',
      bio:'ICT credenciada EMBRAPII com 4 laboratórios de energia renovável. Parceria com a ICT destrava projetos cooperativos e instrumentos exclusivos de fomento.',
      port:['EMBRAPII · Transição energética · R$ 1,6 mi · 2025','Projeto cooperativo · Hidrogênio · R$ 2,8 mi · 2024'],
      rev:[['A parceria com o Lab viabilizou um edital que sozinhos não poderíamos acessar.','Proponente · indústria · mai/2026']]},
    {ini:'RT',nome:'Consultor R.T.',loc:'São Paulo-SP',cat:'consultor',tags:'EMBRAPII · Indústria 4.0',stats:'<b>9 projetos aprovados</b> · R$ 5,1 mi captados',rating:'★ 4,8',dest:false,souser:false,resp:'responde em ~4h',
      bio:'Especialista em projetos cooperativos EMBRAPII para indústria 4.0, com forte rede de Unidades credenciadas no Sudeste.',
      port:['EMBRAPII · Manufatura avançada · R$ 1,8 mi · 2025','SENAI Inovação · IoT industrial · R$ 540 mil · 2024'],
      rev:[['Encontrou a Unidade EMBRAPII certa em uma semana.','Proponente · manufatura · fev/2026']]},
    {ini:'LA',nome:'Dr. L.A.',loc:'Recife-PE',cat:'pesquisador',tags:'IA embarcada · Doutor (UFPE)',stats:'<b>7 projetos executados</b> · 14 publicações',rating:'★ 4,9',dest:false,souser:true,resp:'responde em ~6h',
      bio:'Doutor em IA embarcada pela UFPE. Atua como pesquisador-parceiro em projetos de PD&I, fortalecendo a equipe executora exigida pelos editais.',
      port:['CNPq Universal · IA embarcada · 36 meses · 2024','FACEPE · Sistemas inteligentes · 2023'],
      rev:[['A presença dele na equipe mudou a nota do quesito capacidade técnica.','Proponente · agtech · abr/2026']]},
    {ini:'S4',nome:'Squad Quatro Devs',loc:'Remoto · Brasil',cat:'squad',tags:'MVPs e TRL 4–7 · IoT e IA',stats:'<b>17 produtos entregues</b> · squads de 3 a 6 devs',rating:'★ 4,8',dest:false,souser:true,resp:'responde em ~3h',
      bio:'Squad de desenvolvimento para projetos de PD&I: transforma o plano aprovado em produto — firmware, backend e dashboards — com entregas quinzenais auditáveis para a prestação de contas.',
      port:['Plataforma IoT de telemetria · TRL 5→7 · 2025','Sistema embarcado de gestão energética · 2024','MVP de marketplace B2B · 2024'],
      rev:[['Entregas documentadas do jeito que a prestação de contas pede. Raro.','Proponente · energia · jun/2026']]},
    {ini:'DV',nome:'DevHub Nordeste',loc:'Recife-PE',cat:'squad',tags:'Software embarcado · energia',stats:'<b>9 projetos de P&D</b> executados',rating:'★ 4,7',dest:false,souser:false,resp:'responde em ~1 dia',
      bio:'Hub de squads especializado em software embarcado para o setor de energia, com experiência em projetos FINEP e EMBRAPII.',
      port:['Firmware de inversores · projeto FINEP · 2025','Gateway IoT industrial · 2024'],
      rev:[['Time técnico que entende a lógica de projeto de fomento.','Proponente · energia · dez/2025']]},
    {ini:'PF',nome:'Consultora P.F.',loc:'Belo Horizonte-MG',cat:'contas',tags:'Prestação de contas FINEP/CNPq',stats:'<b>31 prestações</b> · zero glosas',rating:'★ 5,0',dest:false,souser:false,resp:'responde em ~5h',
      bio:'Especialista em prestação de contas de recursos públicos (FINEP, CNPq, FAPs). 31 prestações aprovadas sem uma única glosa.',
      port:['Prestação FINEP subvenção · R$ 3,2 mi · 2025','Prestação CNPq · 36 meses · 2024'],
      rev:[['Dormimos tranquilos na auditoria.','Proponente · saúde · mar/2026']]},
    {ini:'CN',nome:'Dra. C.N.',loc:'Campinas-SP',cat:'pesquisador',tags:'Baterias e armazenamento · 2 patentes',stats:'<b>11 projetos executados</b> · 2 patentes',rating:'★ 4,8',dest:false,souser:false,resp:'responde em ~8h',
      bio:'Pesquisadora em eletroquímica e armazenamento de energia, com 2 patentes depositadas e experiência em projetos cooperativos.',
      port:['Baterias de segunda vida · projeto cooperativo · 2025','Célula estacionária · P&D ANEEL · 2023'],
      rev:[['Trouxe rigor científico que o edital exigia.','Proponente · energia · nov/2025']]}
  ];
  PREST.sort(function(a,b){return (b.dest?1:0)-(a.dest?1:0)});
  var CONNSENT={};
  function prBadges(pr){
    var h='';
    if(pr.dest)h+='<span class="pr-badge dest">⭐ Destaque</span>';
    if(pr.souser)h+='<span class="pr-badge souser">▲ usa a MonyU</span>';
    return h?'<span class="pr-badges">'+h+'</span>':'';
  }
  var prestGrid=$('#prestGrid');
  function renderPrest(){
    prestGrid.innerHTML=PREST.map(function(pr,i){
      return '<article class="prest'+(pr.dest?' destaque':'')+'" data-gcat="'+pr.cat+'" data-pr="'+i+'" style="animation-delay:'+(0.03+i*0.04)+'s" tabindex="0" role="button" aria-label="Ver perfil de '+pr.nome+'">'+
        '<div class="prest-head"><span class="prest-avatar" aria-hidden="true">'+pr.ini+'</span>'+
          '<div><b>'+pr.nome+'</b><span>'+pr.loc+' · '+pr.tags+'</span></div>'+
          '<span class="prest-verified">✓ Verificado</span></div>'+
        prBadges(pr)+
        '<span class="prest-stats">'+pr.stats+'</span>'+
        '<span class="prest-rating">'+pr.rating+' <span style="color:var(--text-3);font-weight:500">· '+pr.resp+'</span></span>'+
        (CONNSENT[i]
          ?'<button class="btn-ghost sent" style="font-size:.74rem">✓ Solicitação enviada</button>'
          :'<button class="btn-ghost" data-conn="'+i+'" style="font-size:.74rem">Solicitar conexão</button>')+
        '<button class="ag-more">Ver perfil completo →</button>'+
      '</article>';
    }).join('');
  }
  renderPrest();
  var prDrawer=$('#prDrawer'),prScrim=$('#prScrim'),prInner=$('#prInner');
  function closePr(){prDrawer.classList.remove('open');prScrim.classList.remove('show')}
  function openPr(i){
    var pr=PREST[i];
    prInner.innerHTML=
      '<div class="drawer-head">'+
        '<span class="prest-avatar" style="width:52px;height:52px;font-size:.9rem" aria-hidden="true">'+pr.ini+'</span>'+
        '<div><h3>'+pr.nome+'</h3><div class="drole">'+pr.loc+' · '+pr.tags+'</div>'+
        '<div style="margin-top:.35rem;display:flex;gap:.4rem;flex-wrap:wrap"><span class="prest-verified">✓ Verificado MonyU</span>'+prBadges(pr)+'</div></div>'+
        '<button class="drawer-close" id="prClose" aria-label="Fechar perfil">✕</button>'+
      '</div>'+
      '<div class="drawer-body">'+
        '<div class="dsec"><p style="font-size:.84rem;color:var(--text);font-weight:600;line-height:1.55">'+pr.bio+'</p></div>'+
        '<div class="key-stats" style="grid-template-columns:1fr 1fr;margin-bottom:1.15rem">'+
          '<div class="kstat"><small>Resultados</small><b style="font-size:.78rem">'+pr.stats.replace(/<[^>]+>/g,'')+'</b></div>'+
          '<div class="kstat"><small>Avaliação · resposta</small><b style="font-size:.78rem">'+pr.rating+' · '+pr.resp+'</b></div>'+
        '</div>'+
        '<div class="dsec"><h4>Portfólio verificado</h4><div class="pr-port">'+pr.port.map(function(x){return '<div>'+x+'</div>'}).join('')+'</div></div>'+
        '<div class="dsec"><h4>O que dizem os proponentes</h4>'+pr.rev.map(function(r){return '<div class="pr-quote">“'+r[0]+'”<b>'+r[1]+'</b></div>'}).join('')+'</div>'+
        '<div class="dsec"><h4>Como funciona a conexão</h4><ul class="yes">'+
          '<li>Você solicita — o prestador vê o seu projeto e o contexto</li>'+
          '<li>No aceite, a identidade completa é revelada para os dois lados</li>'+
          '<li>Conversa, proposta e acordo padronizado, tudo dentro da plataforma</li>'+
        '</ul></div>'+
        (pr.dest?'<p style="font-size:.62rem;color:var(--text-3)">⭐ Este perfil contratou Destaque e aparece primeiro nas buscas da sua categoria. O selo Verificado independe do Destaque.</p>':'')+
      '</div>'+
      '<div class="drawer-foot">'+
        (CONNSENT[i]
          ?'<button class="btn-ghost sent">✓ Solicitação enviada</button>'
          :'<button class="btn-primary" data-conn="'+i+'">Solicitar conexão</button>')+
        '<button class="btn-ghost" data-toast="Perfis salvos — em breve no piloto (demo)">☆ Salvar</button>'+
      '</div>';
    prDrawer.classList.add('open');prScrim.classList.add('show');
    prInner.querySelector('#prClose').addEventListener('click',closePr);
  }
  prScrim.addEventListener('click',closePr);
  document.addEventListener('click',function(e){
    var ch=e.target.closest('[data-gchip]');
    if(ch){
      $$('.filter-chip[data-gchip]').forEach(function(x){x.classList.remove('on')});
      ch.classList.add('on');
      var f=ch.getAttribute('data-gchip');
      $$('#prestGrid .prest').forEach(function(c){
        c.style.display=(f==='todos'||c.getAttribute('data-gcat')===f)?'':'none';
      });
      return;
    }
    var nd=e.target.closest('[data-gfilter]');
    if(nd){
      showView('giga');
      var f2=nd.getAttribute('data-gfilter');
      $$('.filter-chip[data-gchip]').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-gchip')===f2)});
      $$('#prestGrid .prest').forEach(function(c){
        c.style.display=(c.getAttribute('data-gcat')===f2)?'':'none';
      });
      return;
    }
    var cn=e.target.closest('[data-conn]');
    if(cn&&!cn.classList.contains('sent')){
      var idx=parseInt(cn.getAttribute('data-conn'),10);
      CONNSENT[idx]=1;
      renderPrest();
      if(prDrawer.classList.contains('open'))openPr(idx);
      toast('Solicitação enviada a '+PREST[idx].nome+'. Você será avisado no aceite — a conversa acontece dentro da plataforma. (demo)');
      return;
    }
    var card=e.target.closest('[data-pr]');
    if(card&&!e.target.closest('button')){openPr(parseInt(card.getAttribute('data-pr'),10));return}
    if(card&&e.target.closest('.ag-more')){openPr(parseInt(card.getAttribute('data-pr'),10))}
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closePr()});

  /* ================= GigaMonyU: ativação de conta (badge-CTA) ================= */
  var gigaActivateBtn=$('#gigaActivateBtn');
  if(gigaActivateBtn)gigaActivateBtn.addEventListener('click',function(){
    if(store.get('giga-activated','')==='1'){toast('Sua conta GigaMonyU já está ativa.');return}
    store.set('giga-activated','1');
    gigaActivateBtn.textContent='✓ Conta ativada';
    gigaActivateBtn.disabled=true;
    toast('Conta GigaMonyU ativada, gratuita, sem custo. (demo)');
    if(typeof rwUnlock==='function')rwUnlock('gigaativado');
    syncGigaMemberUI();
  });
  var gigaProfileBtn=$('#gigaProfileBtn');
  if(gigaProfileBtn)gigaProfileBtn.addEventListener('click',function(){
    if(store.get('giga-perfil','')==='1'){toast('Seu perfil no GigaMonyU já está completo.');return}
    store.set('giga-perfil','1');
    gigaProfileBtn.textContent='✓ Perfil completo';
    gigaProfileBtn.disabled=true;
    toast('Perfil completado. (demo)');
    if(typeof rwUnlock==='function')rwUnlock('gigaperfil');
  });
  if(store.get('giga-activated','')==='1'&&gigaActivateBtn){gigaActivateBtn.textContent='✓ Conta ativada';gigaActivateBtn.disabled=true}
  if(store.get('giga-perfil','')==='1'&&gigaProfileBtn){gigaProfileBtn.textContent='✓ Perfil completo';gigaProfileBtn.disabled=true}
  /* Reconhecimento visual "dourado" de membro GigaMonyU (2026-08-07, mockup
     _mockups/mockup-giga-elite-referral.html aprovado): anel no avatar do
     perfil + badge "GIGAMONYU" abaixo do nome + tag "Membro" no item de nav
     — tudo condicionado ao MESMO flag de ativação acima. O prestador é o
     mesmo usuário/conta, só com mais recursos liberados, não uma persona
     separada. Plano (Freemium/Starter/Pro/Scale) deliberadamente NÃO ganha
     o mesmo tratamento — decisão registrada no mockup e no doc 06 §12. */
  function syncGigaMemberUI(){
    var isMember=store.get('giga-activated','')==='1';
    var av=$('#profileAvatar');if(av)av.classList.toggle('giga-member',isMember);
    var badge=$('#profileGigaBadge');if(badge)badge.style.display=isMember?'':'none';
    var navTag=$('#gigaNavTag');
    if(navTag){navTag.textContent=isMember?'Membro':'prévia';navTag.classList.toggle('giga-on',isMember)}
  }
  syncGigaMemberUI();
  var referCopyBtn=$('#referCopyBtn');
  if(referCopyBtn)referCopyBtn.addEventListener('click',function(){
    var txt=$('#referLinkUrl').textContent;
    function ok(){referCopyBtn.textContent='✓ Copiado';toast('Link de indicação copiado. (demo)');track('referral_link_copiado',{});setTimeout(function(){referCopyBtn.textContent='Copiar link'},2000)}
    function fallback(){var ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch(e){}document.body.removeChild(ta);ok()}
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(ok,fallback);
    else fallback();
  });

  /* ================= Trilhas de treinamento (streaming) ================= */
  var TR_CATS=[
    {key:'fundamentos',name:'Fundamentos'},
    {key:'agentes',name:'Agentes & Plataforma'},
    {key:'recorrente',name:'Captação recorrente & Gestão'},
    {key:'carreira',name:'Carreira & Certificação'}
  ];
  var TRAILS={
    primeira:{name:'Primeira captação',ico:'🌱',gift:0,cat:'fundamentos',feat:true,lessons:[
      {t:'O mapa do fomento não-reembolsável no Brasil',d:'9 min',done:true},
      {t:'Subvenção, cooperativo ou bolsa: qual instrumento é o seu',d:'8 min',done:true},
      {t:'A anatomia de um edital',d:'10 min',done:true},
      {t:'Lendo um edital como um avaliador',d:'11 min'},
      {t:'Elegibilidade: os 7 erros que eliminam antes da nota',d:'8 min'},
      {t:'Contrapartida sem sustos',d:'7 min'},
      {t:'Montando o cronograma físico-financeiro',d:'9 min'},
      {t:'Checklist final antes de submeter',d:'8 min'}]},
    agentes:{name:'Dominando os agentes',ico:'🤖',gift:5,cat:'agentes',feat:true,lessons:[
      {t:'O pipeline da captação em 7 minutos',d:'7 min'},
      {t:'Rico: scans que encontram o edital certo',d:'9 min'},
      {t:'Íris: lendo o diagnóstico como um estrategista',d:'10 min'},
      {t:'Memória: o que indexar (e o que não)',d:'8 min'},
      {t:'Ada: brief perfeito, projeto forte',d:'12 min'},
      {t:'Revisando a Ada: o checklist do olho humano',d:'11 min'},
      {t:'Adaptação: um projeto, várias captações',d:'8 min'},
      {t:'Kai e Aurora: os agentes de estratégia',d:'10 min'},
      {t:'Autonomia: seu time no automático, com segurança',d:'9 min'}]},
    recorrente:{name:'Captação recorrente',ico:'📈',gift:0,cat:'recorrente',feat:false,lessons:[
      {t:'De uma aprovação para um pipeline',d:'9 min'},
      {t:'Gestão de contrapartidas em múltiplos projetos',d:'10 min'},
      {t:'Prestação de contas que protege a próxima captação',d:'11 min'},
      {t:'Relacionamento com o financiador',d:'8 min'},
      {t:'Equipe executora: montando o time recorrente',d:'9 min'},
      {t:'Indicadores que os conselhos querem ver',d:'9 min'},
      {t:'O ciclo anual do fomento: calendário estratégico',d:'9 min'}]},
    diagnostico:{name:'Diagnóstico que aprova',ico:'🔍',gift:0,cat:'fundamentos',feat:false,lessons:[
      {t:'Por que nem todo match de 90% vira aprovação',d:'8 min'},
      {t:'Rico x Íris: o que cada um garante (e o que não garante)',d:'9 min'},
      {t:'Lendo o diagnóstico da Íris como um avaliador leria',d:'10 min'},
      {t:'Os sinais de que um projeto não está pronto para submeter',d:'8 min'},
      {t:'Corrigindo gaps antes de gastar fichas com a Ada',d:'9 min'},
      {t:'Checklist de prontidão antes do diagnóstico',d:'7 min'}]},
    adapratica:{name:'Ada na prática: da ideia ao texto pronto',ico:'✍️',gift:0,cost:8,cat:'agentes',feat:true,lessons:[
      {t:'O que a Ada precisa saber para escrever bem',d:'9 min'},
      {t:'Brief perfeito: o que entra e o que não entra',d:'10 min'},
      {t:'Elaboração vs adaptação: qual pedir e quando',d:'8 min'},
      {t:'Revisão humana: o checklist antes de aceitar o texto',d:'11 min'},
      {t:'Erros comuns que fazem a Ada errar (e como evitar)',d:'9 min'},
      {t:'Reaproveitando um projeto para 3 editais diferentes',d:'10 min'},
      {t:'Da revisão final à submissão: o workspace de cópia',d:'8 min'}]},
    contrapartidas:{name:'Gestão de contrapartidas e prestação de contas',ico:'📋',gift:0,cat:'recorrente',feat:false,lessons:[
      {t:'O que é contrapartida e por que ela trava projetos',d:'8 min'},
      {t:'Contrapartida financeira x econômica: a diferença que importa',d:'9 min'},
      {t:'Prestação de contas: o calendário que ninguém te conta',d:'10 min'},
      {t:'Documentos que a Clara organiza para você',d:'8 min'},
      {t:'Os erros que geram glosa (e como evitá-los)',d:'9 min'},
      {t:'Fechando um ciclo sem perder o próximo edital',d:'8 min'}]},
    fichas:{name:'Fichas e autonomia: gerencie seu consumo',ico:'💠',gift:0,cat:'fundamentos',feat:false,lessons:[
      {t:'Como as fichas funcionam, de verdade',d:'7 min'},
      {t:'Precificação por volume: quando vale rodar em lote',d:'8 min'},
      {t:'Autonomia N1 a N4: qual nível faz sentido pra você',d:'9 min'},
      {t:'Central de Aprovações: aprovando em lote com segurança',d:'8 min'},
      {t:'Modo automático: velocidade sem perder controle',d:'8 min'},
      {t:'Resolvendo saldo baixo sem travar sua captação',d:'7 min'}]},
    radar:{name:'Radar de captação além da subvenção',ico:'🧭',gift:0,cost:10,cat:'recorrente',feat:true,lessons:[
      {t:'Subvenção não é a única porta: o mapa completo do funding',d:'9 min'},
      {t:'Incentivos fiscais: Lei do Bem e Lei da Informática na prática',d:'10 min'},
      {t:'Investimento e capital de risco: quando faz sentido buscar',d:'9 min'},
      {t:'Fomento internacional: como acessar sem se perder',d:'9 min'},
      {t:'Lendo seu radar de aderência (Mike) e priorizando o próximo passo',d:'10 min'},
      {t:'Construindo seu roadmap H1/H2/H3 de captação',d:'9 min'},
      {t:'O calendário anual: Catalisa ICT, Centelha, Tecnova e outros',d:'8 min'}]},
    storytelling:{name:'Storytelling para bancas avaliadoras',ico:'🎤',gift:0,cost:8,cat:'carreira',feat:true,lessons:[
      {t:'Por que avaliadores humanos rejeitam projetos tecnicamente corretos',d:'8 min'},
      {t:'A estrutura de uma narrativa que convence',d:'9 min'},
      {t:'Traduzindo jargão técnico para quem decide',d:'8 min'},
      {t:'Simulando a banca: o que a Banca (agente) já te mostra',d:'9 min'},
      {t:'Defendendo seu projeto em uma banca ao vivo',d:'10 min'},
      {t:'Storytelling para investidores x storytelling para editais públicos',d:'8 min'}]}
  };
  /* Vitrine da Certificação MonyU: não tem entrada em TRAILS (sem lista de aulas própria no piloto),
     por isso é HTML fixo, incluído só na seção "Carreira & Certificação" do agrupamento por categoria.
     Não participa do carrossel de destaque nem do like/dislike/favoritar. */
  var CERT_CARD_HTML='<article class="tr-card cert" style="animation-delay:.05s">'+
      '<div class="tr-cover cat-carreira"><span class="tr-cover-ico" aria-hidden="true">🎓</span></div>'+
      '<div class="tr-card-body">'+
        '<div class="tr-card-name"><b>Certificação MonyU</b></div>'+
        '<span class="trail-meta" style="color:var(--accent-text)">credencial profissional · 24 aulas + avaliação · produto à parte</span>'+
        '<div class="tr-card-foot" style="margin-top:.3rem">'+
          '<button class="btn-primary" data-toast="Detalhes e pré-inscrição da Certificação MonyU — em breve. (demo)">Conhecer a certificação</button>'+
          '<button class="btn-ghost" data-nav="giga" style="font-size:.72rem;padding:.55rem .7rem">Ver GigaMonyU</button>'+
        '</div>'+
      '</div>'+
    '</article>';
  var trOv=$('#trOv'),trKey='',trIdx=0,trCurCat='todas',trOnlyFav=false;
  function trPct(k){var L=TRAILS[k].lessons;return Math.round(L.filter(function(l){return l.done}).length/L.length*100)}
  function trLikeGet(k){return store.get('tr-rate-'+k,'')}
  function trLikeSet(k,v){store.set('tr-rate-'+k,v)}
  function trFavGet(k){return store.get('tr-fav-'+k,'')==='1'}
  function trFavSet(k,v){store.set('tr-fav-'+k,v?'1':'0')}
  function trAllKeys(){return Object.keys(TRAILS)}
  function trBoughtGet(k){return store.get('tr-bought-'+k,'')==='1'}
  function trBoughtSet(k){store.set('tr-bought-'+k,'1')}
  function trUnlocked(k){var T=TRAILS[k];return !T.cost||trBoughtGet(k)||(typeof rwPaidTrainingsUnlocked==='function'&&rwPaidTrainingsUnlocked())}
  function trFeatured(){return trAllKeys().filter(function(k){return TRAILS[k].feat})}
  function trByCat(cat){return trAllKeys().filter(function(k){return TRAILS[k].cat===cat})}
  function trSyncCard(k){
    var L=TRAILS[k].lessons,n=L.filter(function(l){return l.done}).length;
    $$('[data-trbar="'+k+'"]').forEach(function(bar){bar.style.width=trPct(k)+'%'});
    $$('[data-trlabel="'+k+'"]').forEach(function(lab){lab.textContent=n===0?'não iniciada':(n===L.length?'✓ trilha concluída':n+' de '+L.length+' aulas')});
  }
  function trSyncAllCards(){trAllKeys().forEach(function(k){trSyncCard(k)})}
  function trCardHTML(k,idx,opts){
    opts=opts||{};
    var T=TRAILS[k],L=T.lessons,n=L.filter(function(l){return l.done}).length;
    var like=trLikeGet(k),fav=trFavGet(k),unlocked=trUnlocked(k);
    var pct=trPct(k),label=n===0?'não iniciada':(n===L.length?'✓ trilha concluída':n+' de '+L.length+' aulas');
    var btnLabel=!unlocked?'Desbloquear trilha':(n===0?'Começar trilha':(n===L.length?'Rever trilha':'Continuar trilha'));
    return '<article class="tr-card" data-trail="'+k+'" style="animation-delay:'+(0.04+(idx||0)*0.05)+'s">'+
      '<div class="tr-cover cat-'+T.cat+'">'+
        (opts.feat?'<span class="tr-feat-badge">destaque</span>':'')+
        '<span class="tr-cover-ico" aria-hidden="true">'+T.ico+'</span>'+
        '<button class="tr-fav'+(fav?' on':'')+'" data-trfav="'+k+'" aria-label="'+(fav?'Remover da minha lista':'Adicionar à minha lista')+'" aria-pressed="'+fav+'">'+(fav?'♥':'♡')+'</button>'+
      '</div>'+
      '<div class="tr-card-body">'+
        '<div class="tr-card-name"><b>'+T.name+'</b>'+(T.gift?'<span class="trail-gift">🎁 +'+T.gift+'</span>':'')+(T.cost&&!unlocked?'<span class="trail-cost">🪙 '+T.cost+' fichas</span>':'')+'</div>'+
        '<span class="trail-meta">'+L.length+' aulas · certificado MonyU</span>'+
        '<div class="trail-prog"><div class="fichas-bar"><i data-trbar="'+k+'" style="width:'+pct+'%"></i></div><span data-trlabel="'+k+'">'+label+'</span></div>'+
        '<div class="tr-card-foot">'+
          '<button class="btn-primary" data-tropen="'+k+'">'+btnLabel+'</button>'+
          '<span class="tr-rate">'+
            '<button class="tr-like'+(like==='like'?' on':'')+'" data-trlike="'+k+'" aria-label="Gostei" aria-pressed="'+(like==='like')+'">👍</button>'+
            '<button class="tr-dislike'+(like==='dislike'?' on':'')+'" data-trdislike="'+k+'" aria-label="Não gostei" aria-pressed="'+(like==='dislike')+'">👎</button>'+
          '</span>'+
        '</div>'+
      '</div>'+
    '</article>';
  }
  function renderTrCarousel(){
    var el=$('#trCarousel');if(!el)return;
    el.innerHTML=trFeatured().map(function(k,idx){return trCardHTML(k,idx,{feat:true})}).join('');
  }
  function renderTrCatalog(){
    var el=$('#trCatalog');if(!el)return;
    var q=(($('#trSearch')&&$('#trSearch').value)||'').trim().toLowerCase();
    var filtered=!!(q||trCurCat!=='todas'||trOnlyFav);
    if(!filtered){
      el.innerHTML=TR_CATS.map(function(c){
        var ks=trByCat(c.key);
        var cardsHtml=ks.map(function(k,idx){return trCardHTML(k,idx)}).join('')+(c.key==='carreira'?CERT_CARD_HTML:'');
        if(!cardsHtml)return '';
        return '<section class="tr-cat-section" aria-label="'+c.name+'">'+
          '<div class="section-head"><h2>'+c.name+'</h2></div>'+
          '<div class="trails-grid">'+cardsHtml+'</div>'+
        '</section>';
      }).join('');
    }else{
      var keys=trAllKeys().filter(function(k){
        var T=TRAILS[k];
        if(trOnlyFav&&!trFavGet(k))return false;
        if(trCurCat!=='todas'&&T.cat!==trCurCat)return false;
        if(q&&T.name.toLowerCase().indexOf(q)===-1)return false;
        return true;
      });
      el.innerHTML=keys.length
        ? '<div class="trails-grid">'+keys.map(function(k,idx){return trCardHTML(k,idx)}).join('')+'</div>'
        : '<p class="tr-empty">Nenhuma trilha encontrada'+(q?' para "'+q+'"':'')+(trOnlyFav?' na sua lista':'')+'.</p>';
    }
    trSyncAllCards();
  }
  function renderTrainings(){renderTrCarousel();renderTrCatalog()}
  /* Sugestão de próxima trilha ao concluir 100% — prioriza uma trilha ainda não iniciada da mesma
     categoria; se não houver, cai para qualquer trilha não iniciada de qualquer categoria. */
  function trNextRecommendation(k){
    var T=TRAILS[k];
    var notStarted=function(x){return TRAILS[x].lessons.every(function(l){return !l.done})};
    var sameCat=trAllKeys().filter(function(x){return x!==k&&TRAILS[x].cat===T.cat&&notStarted(x)});
    if(sameCat.length)return sameCat[0];
    var any=trAllKeys().filter(function(x){return x!==k&&notStarted(x)});
    return any.length?any[0]:null;
  }
  function renderTrail(){
    var T=TRAILS[trKey],L=T.lessons;
    $('#trIco').textContent=T.ico;
    $('#trName').textContent=T.name;
    $('#trMeta').textContent=L.length+' aulas · certificado MonyU ao concluir'+(T.gift?' · 🎁 +'+T.gift+' fichas':'');
    $('#trProg').textContent=trPct(trKey)+'% concluído';
    $('#trLessons').innerHTML=L.map(function(l,i){
      return '<button class="lesson-item'+(l.done?' done':'')+(i===trIdx?' cur':'')+'" data-lesson="'+i+'">'+
        '<span class="li-n">'+(l.done?'✓':(i+1))+'</span><b>'+l.t+'</b><span>'+l.d+'</span></button>';
    }).join('');
    var cur=L[trIdx];
    $('#trLTitle').textContent='Aula '+(trIdx+1)+': '+cur.t;
    $('#trLMeta').textContent=cur.d+' · '+T.name+(cur.done?' · ✓ concluída':'');
    $('#trDone').textContent=cur.done?'✓ Aula concluída — rever':'✓ Concluir aula e avançar';
    var recEl=$('#trNextRec');
    if(recEl){
      if(trPct(trKey)===100){
        var nk=trNextRecommendation(trKey);
        if(nk){
          var NT=TRAILS[nk];
          recEl.innerHTML='<div class="tr-next-card"><span class="tr-next-label">🎉 Trilha concluída — próxima recomendada</span>'+
            '<div class="tr-next-body"><span class="tr-next-ico" aria-hidden="true">'+NT.ico+'</span><b>'+NT.name+'</b></div>'+
            '<button class="btn-primary" data-tropen="'+nk+'" style="font-size:.76rem;align-self:flex-start">Começar "'+NT.name+'"</button></div>';
        }else{
          recEl.innerHTML='<div class="tr-next-card"><span class="tr-next-label">🎉 Trilha concluída! Você já iniciou todas as demais trilhas.</span></div>';
        }
        recEl.style.display='';
      }else{
        recEl.style.display='none';recEl.innerHTML='';
      }
    }
    trSyncAllCards();
  }
  var pendTrKey='';
  function openTrail(k){
    var T=TRAILS[k];
    if(T.cost&&!trUnlocked(k)){
      pendTrKey=k;
      $('#trBuyName').textContent=T.name;
      $('#trBuyCost').textContent=T.cost;
      $('#trBuySaldo').textContent=saldo;
      open($('#trBuyModal'));
      return;
    }
    openTrailReal(k);
  }
  function openTrailReal(k){
    trKey=k;
    var L=TRAILS[k].lessons,first=0;
    for(var i=0;i<L.length;i++){if(!L[i].done){first=i;break}}
    trIdx=first;
    renderTrail();
    trOv.classList.add('open');
    document.body.style.overflow='hidden';
    document.documentElement.style.overflow='hidden';
  }
  $('#trBuyConfirm').addEventListener('click',function(){
    var T=TRAILS[pendTrKey];
    if(saldo<T.cost){
      close($('#trBuyModal'));
      resolverSaldo(T.cost-saldo,null,function(){});
      return;
    }
    saldo-=T.cost;syncSaldo();
    trBoughtSet(pendTrKey);
    close($('#trBuyModal'));
    toast('Trilha desbloqueada — '+T.cost+' fichas debitadas. (demo)');
    renderTrainings();
    openTrailReal(pendTrKey);
  });
  function closeTrail(){trOv.classList.remove('open');document.body.style.overflow='';document.documentElement.style.overflow=''}
  document.addEventListener('click',function(e){
    var tb=e.target.closest('[data-tropen]');
    if(tb){openTrail(tb.getAttribute('data-tropen'));return}
    var li=e.target.closest('[data-lesson]');
    if(li){trIdx=parseInt(li.getAttribute('data-lesson'),10);renderTrail();return}
    var likeBtn=e.target.closest('[data-trlike]');
    if(likeBtn){
      var lk=likeBtn.getAttribute('data-trlike');
      trLikeSet(lk,trLikeGet(lk)==='like'?'':'like');
      renderTrainings();
      return;
    }
    var dislikeBtn=e.target.closest('[data-trdislike]');
    if(dislikeBtn){
      var dk=dislikeBtn.getAttribute('data-trdislike');
      trLikeSet(dk,trLikeGet(dk)==='dislike'?'':'dislike');
      renderTrainings();
      return;
    }
    var favBtn=e.target.closest('[data-trfav]');
    if(favBtn){
      var fk=favBtn.getAttribute('data-trfav');
      trFavSet(fk,!trFavGet(fk));
      renderTrainings();
      return;
    }
  });
  $('#trClose').addEventListener('click',closeTrail);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&trOv.classList.contains('open'))closeTrail()});
  $('#trDone').addEventListener('click',function(){
    var T=TRAILS[trKey],L=T.lessons;
    if(!L[trIdx].done){
      L[trIdx].done=true;
      var all=L.every(function(l){return l.done});
      if(all){
        if(T.gift){saldo+=T.gift;syncSaldo();}
        toast('🎉 Trilha "'+T.name+'" concluída! Certificado MonyU emitido'+(T.gift?' + '+T.gift+' fichas adicionadas ao seu saldo':'')+'. (demo)');
        if(typeof rwAddXp==='function'){
          rwAddXp(15);
          if(typeof rwRecalcAll==='function')rwRecalcAll();
        }
      }else{
        toast('Aula concluída! Próxima: '+(L[trIdx+1]?L[trIdx+1].t:'—'));
      }
      for(var i=0;i<L.length;i++){if(!L[i].done){trIdx=i;break}}
    }
    renderTrail();
  });
  var trSearchInput=$('#trSearch');
  if(trSearchInput)trSearchInput.addEventListener('input',renderTrCatalog);
  $$('.filter-chip[data-trcat]').forEach(function(ch){
    ch.addEventListener('click',function(){
      $$('.filter-chip[data-trcat]').forEach(function(x){x.classList.remove('on')});
      ch.classList.add('on');
      trCurCat=ch.getAttribute('data-trcat');
      renderTrCatalog();
    });
  });
  $$('.tr-tab[data-trtab]').forEach(function(b){
    b.addEventListener('click',function(){
      $$('.tr-tab[data-trtab]').forEach(function(x){x.classList.remove('on')});
      b.classList.add('on');
      trOnlyFav=b.getAttribute('data-trtab')==='minhalista';
      renderTrCatalog();
    });
  });
  var trCarEl=$('#trCarousel'),trCarPrev=$('#trCarPrev'),trCarNext=$('#trCarNext');
  if(trCarPrev)trCarPrev.addEventListener('click',function(){if(trCarEl)trCarEl.scrollBy({left:-320,behavior:'smooth'})});
  if(trCarNext)trCarNext.addEventListener('click',function(){if(trCarEl)trCarEl.scrollBy({left:320,behavior:'smooth'})});
  renderTrainings();
  if(typeof rwTrackWeek==='function'){rwTrackWeek();rwRecalcAll()}
  rwSyncChip();

  /* ================= Onboarding ================= */
  function obAgent(k,name,what,value,cost,state){
    var st=state==='on'?'<span class="ob-state on">✓ Incluído no seu plano</span>'
      :state==='beta'?'<span class="ob-state on">✓ Incluído · beta com revisão humana</span>'
      :'<button class="ob-state soon" '+(k==='banca'?'data-soonmod="banca"':'data-toast="Anotado! Vamos te avisar quando '+name+' chegar. (demo)"')+'>🔔 '+state+' · Avisar-me</button>';
    return '<div class="ob-agent" style="--ac:var(--c-'+k+')">'+
      '<svg class="av" aria-hidden="true"><use href="'+avatarHref(k)+'"/></svg>'+
      '<b>'+name+'</b><span class="oa-what">'+what+'</span>'+
      '<span class="oa-value">→ '+value+'</span>'+
      '<span class="oa-cost"><span class="ficha-coin">M</span>'+cost+'</span>'+st+'</div>';
  }
  var OB_STEPS=[
    {h:'Você acaba de ganhar uma equipe 👋',
     b:'<div class="ob-hero"><svg width="84" height="84" aria-hidden="true"><use href="#monyu-symbol"/></svg></div>'+
       '<p>A <b>MonyU</b> é um time de <b>14 agentes de IA</b> que trabalha a sua captação de recursos — de achar a oportunidade certa a deixar o projeto escrito e pronto para você enviar. <b>Você comanda; eles executam.</b></p>'+
       '<div class="ob-avrow"><svg class="av"><use href="#av-rico"/></svg><svg class="av"><use href="#av-iris"/></svg><svg class="av"><use href="#av-ada"/></svg><svg class="av"><use href="#av-aurora"/></svg><svg class="av"><use href="#av-kai"/></svg><svg class="av"><use href="#monyu-symbol"/></svg></div>'},
    {h:'Fichas: a moeda do seu time 🪙',
     b:'<div class="ob-hero"><span class="ficha-coin" style="width:64px;height:64px;font-size:1.6rem">M</span></div>'+
       '<p>Cada ação de um agente consome <b>fichas</b> do seu plano. As regras são simples:</p>'+
       '<div class="ob-note">✓ O custo aparece <b>sempre antes</b> de executar<br>✓ Nada roda sem a sua confirmação<br>✓ Fichas não usadas acumulam por 90 dias<br>Ex.: scan do Rico = 1 ficha · diagnóstico da Íris = 5 · projeto da Ada = 20</div>'},
    {h:'A jornada: do edital certo ao projeto pronto 🛣',
     b:'<p>Cinco passos centrais organizam a captação. Bartô entra como gate condicional quando a decisão exige viabilidade integrada:</p>'+
       '<div class="ob-avrow"><svg class="av"><use href="#av-rico"/></svg>→<svg class="av"><use href="#av-iris"/></svg>→<svg class="av"><use href="#av-carlito"/></svg>→<svg class="av"><use href="#av-ada"/></svg>→<svg class="av"><use href="#av-banca"/></svg></div><div class="ob-note" style="margin-bottom:.65rem"><b>Gate Bartô:</b> depois de Aurora, Íris ou Kai e antes de Carlito/Ada quando houver capital, contrapartida, novidade ou risco material.</div>'+
       '<p style="text-align:center;font-size:.74rem;color:var(--text-3)">encontrar → validar → documentar → elaborar → avaliar → <b>você submete</b></p>'+
       '<div class="ob-note">O documento final fica pronto na tela, seção por seção, para você revisar e colar no formulário oficial do edital.</div>'},
    {h:'Descobrir — onde está o dinheiro e o que vale perseguir 🔍',
     b:'<div class="ob-cards">'+
       obAgent('rico','Rico','Vigia centenas de fontes de fomento, calcula o match e mostra um checklist objetivo de premissas do edital: o que o seu projeto já cumpre e o que falta.','Você nunca mais perde um edital — nem um prazo.','1 a 3 fichas por scan','on')+
       obAgent('aurora','Aurora','Mapa estratégico completo: mercado, tendências e tese de captação.','A foto do potencial do seu negócio.','15 fichas por discovery','on')+
       obAgent('romeu','Romeu','Pesquisa novas aplicações da sua solução e monta o roadmap pelos 3 horizontes de crescimento.','Deixa de esperar edital aparecer — você cria o próprio pipeline.','15 fichas por geração','em desenvolvimento')+
       obAgent('mike','Mike','Dinheiro além da subvenção: incentivo fiscal, investimento, capital de risco e fomento internacional.','Mais de um caminho para financiar a mesma ideia.','10 fichas por tese','beta')+
       '</div>'},
    {h:'Decidir — vale a pena investir neste projeto? 🧭',
     b:'<div class="ob-cards">'+
       obAgent('iris','Íris','Analisa o potencial de captação do projeto — modelo de negócio, maturidade, equipe, academia, ODS — avulso ou por edital.','Evita semanas de trabalho no edital errado.','5 fichas por diagnóstico','on')+
       obAgent('kai','Kai','Valida o problema-solução do projeto pelo método Ishikawa.','Base sólida antes de investir na escrita — e edital que pontua mercado adora.','10 fichas por sessão','beta')+
       obAgent('barto','Bartô','Confronta a viabilidade do negócio com 19 especialistas e devolve uma recomendação rastreável.','Você decide antes de comprometer capital, contrapartida ou reputação.','15 fichas por estudo','em desenvolvimento')+
       '</div>'},
    {h:'Construir — tirar o projeto do papel ✍️',
     b:'<div class="ob-cards">'+
       obAgent('eros','Eros','Encontra pesquisadores, consultores e ICTs — <b>antes</b> de escrever, porque o arranjo precisa entrar no projeto.','O time certo, verificado pela MonyU.','5 fichas','2027')+
       obAgent('ada','Ada','Escreve o projeto inteiro no formato exato do edital, seção por seção, em blocos prontos para copiar.','De semanas de escrita para horas de revisão.','20 fichas · adaptação 5','beta')+
       obAgent('carlito','Carlito','Checklist documental do edital + monitoramento das suas certidões.','A parte chata, resolvida sem sustos.','5 fichas','out/2026')+
       obAgent('banca','A Banca','Conselho de avaliadores simulados dá nota antes da banca real.','Você envia só quando o projeto está forte.','10 fichas','nov/2026')+
       obAgent('laura','Laura','Roteiro e pitch deck do projeto — genérico, para investidor ou colado num edital.','A mesma história, contada para quem decide.','5 fichas o roteiro · 25 a apresentação','em desenvolvimento')+
       '</div>'},
    {h:'Depois da submissão — porque não acaba no envio 🏁',
     b:'<p>Dois agentes cuidam do que vem depois: quando aprova, e quando não aprova.</p>'+
       '<div class="ob-cards">'+
       obAgent('rui','Rui','Lê o parecer dos avaliadores, separa o que é recorrível do que não é e redige a peça dentro do prazo.','Reprovação deixa de ser ponto final.','10 fichas por recurso','em desenvolvimento')+
       obAgent('clara','Clara','Prestação de contas do recurso aprovado, no padrão do financiador.','Aprovação sem dor de cabeça depois.','20 fichas','2027')+
       '</div>'+
       '<div class="ob-note">O prazo de recurso é fatal e costuma ser curto. O Rui sempre pede a sua confirmação antes de dar a peça por concluída.</div>'},
    {h:'Eles trabalham em paralelo — você vive sua vida ⚡',
     b:'<div class="ob-mock-tray"><div class="tray-head"><span class="spin"></span>Atividade dos agentes <span style="color:var(--text-3);font-weight:600;font-size:.72rem">· 3 em execução</span></div>'+
       '<div class="tray-item"><svg class="av"><use href="#av-rico"/></svg><div class="t-body"><div class="t-label">Rico — scan de oportunidades · Todos os projetos</div><div class="tray-prog"><i></i></div></div></div>'+
       '<div class="tray-item"><svg class="av"><use href="#av-iris"/></svg><div class="t-body"><div class="t-label">Íris — diagnóstico · Plataforma IoT</div><div class="tray-prog"><i></i></div></div></div>'+
       '<div class="tray-item"><svg class="av"><use href="#av-ada"/></svg><div class="t-body"><div class="t-label">Ada — elaboração · Microrredes solares</div><div class="tray-prog"><i></i></div></div></div></div>'+
       '<p>Vários agentes rodam ao mesmo tempo. A caixa <b>Atividade dos agentes</b> mostra tudo no canto da tela — minimize e siga o seu dia. <b>Avisamos só quando importa</b>, e cada resultado fica a um clique.</p>'},
    {h:'Autonomia: você decide o quanto eles andam sozinhos 🎚',
     b:'<div class="ob-lvls" id="obLvls">'+
       '<div class="ob-lvl" data-lvl="1"><b>N1 · Guiado</b>você inicia cada ação</div>'+
       '<div class="ob-lvl" data-lvl="2"><b>N2 · Assistido</b>o agente recomenda, você aprova</div>'+
       '<div class="ob-lvl" data-lvl="3"><b>N3 · Semi-automático</b>roda sozinho até um teto de fichas</div>'+
       '<div class="ob-lvl" data-lvl="4"><b>N4 · Automático</b>trabalha por você e avisa quando importa</div></div>'+
       '<p>Cada agente tem seu seletor no painel dele. Suba de nível quando confiar — e <b>volte ao Guiado com um clique</b>. Nada roda fora do que você autorizar.</p>'},
    {h:'Seus espaços de trabalho 🗂',
     b:'<div class="ob-cards">'+
       '<div class="ob-agent" style="--ac:var(--c-rico)"><b>🎯 Oportunidades</b><span class="oa-what">Editais com % de match para os seus projetos, prazos e cronogramas completos.</span><span class="oa-value">→ O edital certo encontra você.</span><span class="ob-state on"><span class="ob-live"></span>6 editais com match agora</span></div>'+
       '<div class="ob-agent" style="--ac:var(--c-ada)"><b>📁 Meus Projetos</b><span class="oa-what">Cada projeto com sua etapa na jornada e os próximos passos recomendados.</span><span class="oa-value">→ Clareza do que fazer agora.</span><span class="ob-state on"><span class="ob-live"></span>4 projetos em andamento</span></div>'+
       '<div class="ob-agent" style="--ac:var(--c-iris)"><b>📚 Memória</b><span class="oa-what">Seus documentos organizados por projeto ou globais — os agentes consultam antes de cada tarefa.</span><span class="oa-value">→ Outputs cada vez mais precisos.</span><span class="ob-state on"><span class="ob-live"></span>14 documentos indexados</span></div>'+
       '</div>'},
    {h:'E quando você quiser mais 🚀',
     b:'<div class="ob-cards">'+
       '<div class="ob-agent" style="--ac:var(--c-eros)"><b>🤝 GigaMonyU</b><span class="oa-what">Vitrine de consultores, pesquisadores, ICTs e squads verificados para executar com você — sem caçar fora da plataforma.</span>'+
         '<ul class="ob-feat">'+
           '<li>Perfis com anonimato controlado — identidade completa só após você aceitar a conexão</li>'+
           '<li>Badges ⭐ Destaque e ▲ usa a MonyU, pra você saber com quem está falando</li>'+
           '<li>Squads de desenvolvimento e prestação de contas também na vitrine</li>'+
         '</ul>'+
         '<div class="ob-mock ob-mock-giga">'+
           '<div class="mg-row"><span class="mg-av" style="background:var(--c-eros)"></span><div class="mg-b"><b>Consultora M.S.</b><small>Energia solar · ⭐ Destaque</small></div><span class="mg-btn">Conectar</span></div>'+
           '<div class="mg-row"><span class="mg-av" style="background:var(--c-rico)"></span><div class="mg-b"><b>ICT parceira ▲</b><small>PD&amp;I aplicada · usa a MonyU</small></div><span class="mg-btn">Conectar</span></div>'+
         '</div>'+
         '<button class="ob-state soon" data-soonmod="giga">🔔 out–dez/2026 · Avisar-me</button></div>'+
       '<div class="ob-agent" style="--ac:var(--c-kai)"><b>🎓 Treinamentos</b><span class="oa-what">Trilhas práticas de captação de recursos + Certificação MonyU — domine o jogo do fomento.</span>'+
         '<ul class="ob-feat">'+
           '<li>4 trilhas: Primeira captação, Dominando os agentes, Captação recorrente e Certificação MonyU</li>'+
           '<li>Aulas contextuais ligadas à dúvida — direto da tela da Ada, Íris ou Memória</li>'+
           '<li>Conclua "Dominando os agentes" e ganhe 🎁 +5 fichas de bônus</li>'+
         '</ul>'+
         '<div class="ob-mock ob-mock-trein">'+
           '<div class="mt-row"><span>Primeira captação</span><div class="mt-bar"><i style="width:40%"></i></div><small>40%</small></div>'+
           '<div class="mt-row"><span>Dominando os agentes</span><div class="mt-bar"><i style="width:15%"></i></div><small>🎁 +5 fichas</small></div>'+
         '</div>'+
         '<button class="ob-state soon" data-soonmod="trein">🔔 4º tri/2026 · Avisar-me</button></div>'+
       '</div>'+
       '<div class="ob-note">Dúvidas a qualquer momento? <b>Ajuda &amp; FAQ</b> no menu reabre este tour.</div>'},
    {h:'Já tem um projeto elaborado? Importe agora 📦',
     b:'<p><b>É grátis e não gasta fichas.</b> Suba o projeto escrito — e também pitch deck, anotações, apresentações, lean canvas e outros documentos. Tudo vira contexto exclusivo do projeto na Memória, e os agentes começam a trabalhar já conhecendo a sua história.</p>'+
       '<div class="ob-note">Inclusos <b>10 documentos ou 200 páginas por projeto</b>. Acima disso, indexação a 1 ficha por lote de 20 páginas. Os arquivos originais continuam na sua nuvem — nós guardamos só o índice.</div>'+
       '<div style="display:flex;gap:.6rem;margin-top:1rem;flex-wrap:wrap">'+
       '<button class="btn-primary" id="obImportBtn" style="flex:1">📦 Importar meu projeto</button>'+
       '<button class="btn-ghost" id="obZeroBtn" style="flex:1">Começar do zero</button>'+
       '<button class="btn-ghost" id="obFreeBtn" style="flex:1">Explorar sozinho</button></div>'}
  ];
  var obOv=$('#obOv'),obIdx=0,obImport=false,obLvlTimer=null;
  function renderOb(){
    if(obLvlTimer){clearInterval(obLvlTimer);obLvlTimer=null}
    var s=OB_STEPS[obIdx];
    $('#obBody').innerHTML='<h2>'+s.h+'</h2>'+s.b;
    $('#obDots').textContent=(obIdx+1)+' de '+OB_STEPS.length;
    $('#obProg').style.width=Math.round((obIdx+1)/OB_STEPS.length*100)+'%';
    $('#obPrev').style.visibility=obIdx===0?'hidden':'visible';
    $('#obNext').style.display=obIdx===OB_STEPS.length-1?'none':'';
    var b1=$('#obImportBtn');
    if(b1){
      b1.addEventListener('click',function(){
        obImport=true;finishOb();
        showView('projetos');npSetMode('import');open($('#newProjModal'));
      });
      $('#obZeroBtn').addEventListener('click',function(){finishOb();showView('projetos');npSetMode('zero');open($('#newProjModal'))});
      $('#obFreeBtn').addEventListener('click',function(){finishOb();toast('Explore à vontade — o tour fica em Ajuda & FAQ quando precisar.')});
    }
    var lvls=$('#obLvls');
    if(lvls){
      var items=Array.prototype.slice.call(lvls.querySelectorAll('.ob-lvl')),cur=0;
      items[cur].classList.add('hl');
      obLvlTimer=setInterval(function(){
        items[cur].classList.remove('hl');
        cur=(cur+1)%items.length;
        items[cur].classList.add('hl');
      },1400);
    }
  }
  function openOb(i){obIdx=i||0;renderOb();obOv.classList.add('open');document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden'}
  function finishOb(){if(obLvlTimer){clearInterval(obLvlTimer);obLvlTimer=null}obOv.classList.remove('open');document.body.style.overflow='';document.documentElement.style.overflow='';store.set('onboarded','1');if(typeof rwUnlock==='function')rwUnlock('boasvindas')}
  $('#obNext').addEventListener('click',function(){if(obIdx<OB_STEPS.length-1){obIdx++;renderOb()}});
  $('#obPrev').addEventListener('click',function(){if(obIdx>0){obIdx--;renderOb()}});
  $('#obSkip').addEventListener('click',function(){finishOb();toast('Tutorial disponível a qualquer momento em Ajuda & FAQ.')});
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-ob]');
    if(t){e.preventDefault();openOb(parseInt(t.getAttribute('data-ob'),10)||0)}
  });
  if(store.get('onboarded','')!=='1'){setTimeout(function(){openOb(0)},600)}

  /* ================= Próximos passos pós-importação ================= */
  var nsCurPid=null;
  function openNextSteps(pid){
    nsCurPid=pid;
    var pname=PROJECTS[pid].name;
    $('#nsList').innerHTML=[
      ['rico','1º · Encontrar editais com match','Rico varre as fontes e traz oportunidades com a cara de "'+pname+'".','Rodar Rico · 1 ficha'],
      ['iris','2º · Diagnosticar o melhor match','Íris responde: vale a pena competir? O que falta para ser elegível?','Rodar Íris · 5 fichas'],
      ['kai','3º · Fortalecer a base (se precisar)','Se o diagnóstico apontar lacunas, Kai valida o problema-solução (10) e Aurora amplia a tese (15).','Sessão com Kai · 10 fichas']
    ].map(function(x){
      return '<div class="match-row" style="cursor:default">'+
        '<svg class="av" style="width:36px;height:36px" aria-hidden="true"><use href="#av-'+x[0]+'"/></svg>'+
        '<span class="mr-name">'+x[1]+'<small>'+x[2]+'</small></span>'+
        '<button class="btn-primary" data-ns-agent="'+x[0]+'" data-ns-proj="'+pid+'" style="font-size:.7rem;padding:.5rem .8rem;white-space:nowrap">'+x[3]+'</button>'+
      '</div>';
    }).join('');
    open($('#nsModal'));
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-ns-agent]');
    if(b){close($('#nsModal'));openRun(b.getAttribute('data-ns-agent'),b.getAttribute('data-ns-proj'))}
    if(e.target.closest('#nsGoProjects')){close($('#nsModal'));showView('projetos')}
    if(e.target.closest('#nsGoKnowledge')){close($('#nsModal'));kbCur=nsCurPid||'global';renderKb();showView('conhecimento')}
  });

  /* ================= Especialista (GigaMonyU) =================
     Um único fluxo por trás dos 2 pontos de entrada (botão fixo da sidebar
     e o "Revisão de especialista MonyU" do workspace de projeto): conecta
     o projeto a um time multidisciplinar do GigaMonyU, 50 fichas, até 48h.
     As fichas debitadas aqui são creditadas ao(s) membro(s) do GigaMonyU
     que atuarem — mecânica e notificação do lado do prestador ainda não
     têm tela própria neste piloto (não existe login/persona de prestador
     aqui), documentado como mockup à parte. */
  var specProjSel=$('#specProj'),specProjField=$('#specProjField'),specProjLockedField=$('#specProjLockedField'),
      specProjLockedName=$('#specProjLockedName'),specNeedInput=$('#specNeed'),specConfirmBtn=$('#specConfirm'),
      specLockedPid=null;
  if(specProjSel){
    Object.keys(PROJECTS).forEach(function(pid){
      var o=document.createElement('option');o.value=pid;o.textContent=PROJECTS[pid].name;specProjSel.appendChild(o);
    });
  }
  function specUpdateConfirmState(){
    if(!specConfirmBtn)return;
    var valid=specLockedPid?true:!!(specProjSel&&specProjSel.value);
    specConfirmBtn.disabled=!valid;
  }
  function specCurrentPid(){return specLockedPid||(specProjSel?specProjSel.value:'')}
  /* Entrada sem projeto em foco (sidebar): escolha obrigatória, select vazio.
     Entrada de dentro de um projeto (workspace, sempre p1 neste piloto): o
     projeto já é conhecido, então vira uma linha travada em vez de repetir
     a pergunta pra quem já está no contexto certo. */
  function openSpecModal(pid){
    specLockedPid=pid||null;
    if(specNeedInput)specNeedInput.value='';
    if(specLockedPid){
      if(specProjField)specProjField.style.display='none';
      if(specProjLockedField)specProjLockedField.style.display='';
      if(specProjLockedName)specProjLockedName.textContent=PROJECTS[specLockedPid].short;
    }else{
      if(specProjField)specProjField.style.display='';
      if(specProjLockedField)specProjLockedField.style.display='none';
      if(specProjSel)specProjSel.value='';
    }
    specUpdateConfirmState();
    open($('#specModal'));
  }
  $('#ctaSpec').addEventListener('click',function(){openSpecModal(null)});
  var wsSpecBtn=$('#wsSpecBtn');
  if(wsSpecBtn)wsSpecBtn.addEventListener('click',function(){openSpecModal('p1')});
  if(specProjSel)specProjSel.addEventListener('change',specUpdateConfirmState);
  var SPEC_CUSTO=50;
  function specConfirmRequest(){
    var pid=specCurrentPid(),proj=PROJECTS[pid];
    saldo=Math.max(0,saldo-SPEC_CUSTO);syncSaldo();
    close($('#specModal'));
    toast('Solicitação enviada! Um time do GigaMonyU vai revisar '+(proj?'o projeto '+proj.short:'seu projeto')+' em até 48h. (demo)');
    track('spec_review_solicitada',{custo:SPEC_CUSTO,projeto:pid,necessidade:!!(specNeedInput&&specNeedInput.value.trim())});
  }
  if(specConfirmBtn)specConfirmBtn.addEventListener('click',function(){
    if(!specCurrentPid())return;
    if(saldo<SPEC_CUSTO){resolverSaldo(SPEC_CUSTO-saldo,'A revisão de especialista custa 50 fichas.',specConfirmRequest);return}
    specConfirmRequest();
  });

  /* ================= Paleta de comandos ================= */
  var cmdk=$('#cmdk'),cmdkInput=$('#cmdkInput'),cmdkList=$('#cmdkList');
  var commands=[
    {t:'Ir para Início',run:function(){showView('inicio')}},
    {t:'Ir para Meus projetos',run:function(){showView('projetos')}},
    {t:'Ir para Oportunidades',run:function(){showView('radar')}},
    {t:'Ir para Meus Agentes',run:function(){showView('agentes')}},
    {t:'Ir para Memória',run:function(){showView('conhecimento')}},
    {t:'Revisar e copiar projeto no workspace da Ada',run:function(){openWs()},zeroSkip:true},
    {t:'Adicionar à Memória (indexar documentos)',run:function(){showView('conhecimento');open($('#kbModal'))}},
    {t:'Ir para GigaMonyU (prévia)',run:function(){showView('giga')}},
    {t:'Ir para Treinamentos (prévia)',run:function(){showView('trein')}},
    {t:'Rever o tutorial de boas-vindas',run:function(){openOb(0)}},
    {t:'Revisão de especialista MonyU (GigaMonyU) · 50 fichas',run:function(){openSpecModal(null)}},
    {t:'Executar scan do Rico · a partir de 1 ficha',run:function(){openRun('rico')}},
    {t:'Diagnóstico de elegibilidade (Íris) · a partir de 5 fichas',run:function(){openRun('iris')}},
    {t:'Elaborar projeto (Ada) · a partir de 20 fichas',run:function(){openRun('ada')}},
    {t:'Discovery estratégico (Aurora) · a partir de 15 fichas',run:function(){openRun('aurora')}},
    {t:'Sessão PSF (Kai) · a partir de 10 fichas',run:function(){openRun('kai')}},
    {t:'Elaborar Tese de Funding (Mike) · 20 fichas por projeto',run:function(){openRun('mike')}},
    {t:'Resumo da semana',run:function(){open($('#sumModal'))},zeroSkip:true},
    {t:'Cadastrar novo projeto',run:function(){showView('projetos');open($('#newProjModal'))}},
    {t:'Comprar fichas avulsas',run:openBuy},
    {t:'Mudar de plano',run:openPlans}
  ];
  if(isZeroMode)commands=commands.filter(function(c){return !c.zeroSkip});
  function renderCmd(filter){
    var f=(filter||'').toLowerCase();
    var items=commands.filter(function(c){return c.t.toLowerCase().indexOf(f)>-1});
    cmdkList.innerHTML=items.length
      ? items.map(function(c){return '<button class="cmdk-item" data-i="'+commands.indexOf(c)+'">'+c.t+'</button>'}).join('')
      : '<div class="cmdk-empty">Nenhum comando encontrado para “'+filter+'”.</div>';
    cmdkList.querySelectorAll('.cmdk-item').forEach(function(b){
      b.addEventListener('click',function(){
        closeCmdk();
        commands[parseInt(b.getAttribute('data-i'),10)].run();
      });
    });
  }
  function openCmdk(){cmdk.classList.add('open');cmdkInput.value='';renderCmd('');cmdkInput.focus()}
  function closeCmdk(){cmdk.classList.remove('open')}
  $('#searchBtn').addEventListener('click',openCmdk);
  cmdkInput.addEventListener('input',function(){renderCmd(cmdkInput.value)});
  cmdk.addEventListener('click',function(e){if(e.target===cmdk)closeCmdk()});
  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCmdk()}
    if(e.key==='Escape'){
      closeCmdk();closeSidebar();
      panel.classList.remove('open');notifPanel.classList.remove('open');
      $$('.modal.open').forEach(function(m){close(m)});
    }
  });


  /* ================= Telas novas da v29 =================
     Rotinas, Atividade e Resultados. Renderizadas a partir dos mesmos dados de
     demonstracao das demais telas, para o piloto ficar coerente. O desenho
     completo de cada uma vive nos mockups standalone em `_mockups/`
     (mockup-rotinas.html, mockup-atividade.html, mockup-resultados.html). */

  /* ================= Rotinas — dados e motor de frase (v29) =================
     Cada rotina guarda ETAPAS estruturadas (agente, atividade, teto de fichas,
     saída); nome, agentes envolvidos, teto por execução e a frase legível são
     todos DERIVADOS das etapas, nunca escritos à mão — é o mesmo texto que sai
     do editor, então listagem e editor nunca divergem (regra 20.3 do doc 06:
     a rotina é uma frase, a lista de etapas é só a forma de editá-la). */
  var ROT_FREQS=[
    {k:'semanal',label:'Toda semana',abre:'Toda semana',execMes:4},
    {k:'quinzenal',label:'A cada 2 semanas',abre:'A cada 2 semanas',execMes:2},
    {k:'mensal',label:'Todo mês',abre:'Todo mês',execMes:1},
    {k:'bimestral',label:'A cada 2 meses',abre:'A cada 2 meses',execMes:.5},
    {k:'manual',label:'Só quando eu rodar',abre:'Quando você rodar manualmente',execMes:0}
  ];
  /* Sempre no infinitivo — o gerador de frase usa "vai <atividade>" em todo
     passo, o que evita ter que conjugar verbo por agente/pessoa. */
  var ROT_ATIVIDADES={
    rico:['procurar oportunidades'],
    iris:['diagnosticar o potencial'],
    kai:['validar o problema-solução'],
    ada:['elaborar o projeto','adaptar o projeto para outro edital'],
    aurora:['atualizar o discovery estratégico'],
    barto:['revisar a viabilidade do negócio'],
    romeu:['pesquisar novas aplicações e atualizar o roadmap'],
    mike:['mapear a tese de funding'],
    eros:['buscar parceiros compatíveis','buscar parceiros e enviar convite'],
    carlito:['montar o checklist documental'],
    banca:['avaliar o projeto antes da submissão'],
    laura:['criar o roteiro do pitch','montar a apresentação completa'],
    clara:['organizar a prestação de contas'],
    rui:['redigir o recurso administrativo']
  };
  var ROT_ARTIGO={rico:'o',iris:'a',ada:'a',aurora:'a',mike:'o',kai:'o',barto:'o',
    carlito:'o',banca:'a',clara:'a',eros:'o',romeu:'o',laura:'a',rui:'o'};
  function rotArtigoNome(k){
    var art=k==='banca'?'a':(ROT_ARTIGO[k]||'o');
    var nome=k==='banca'?'Banca':nomeAgente(k);
    return art+' <b>'+nome+'</b>';
  }
  function rotFreqInfo(freq){return ROT_FREQS.filter(function(f){return f.k===freq})[0]||ROT_FREQS[2]}
  function rotTetoTotal(etapas){return (etapas||[]).reduce(function(s,e){return s+(parseInt(e.teto,10)||0)},0)}
  function rotAgentesUnicos(etapas){
    var seen={},out=[];
    (etapas||[]).forEach(function(e){if(e.agente&&!seen[e.agente]){seen[e.agente]=1;out.push(e.agente)}});
    return out;
  }
  function rotFraseHTML(freq,etapas,obs){
    if(!etapas||!etapas.length)return 'Adicione etapas para ver como a rotina vai funcionar.';
    var freqInfo=rotFreqInfo(freq);
    var partes=[];
    etapas.forEach(function(e,i){
      var frag=rotArtigoNome(e.agente)+' vai '+e.atividade;
      if(i===0){partes.push(freqInfo.abre+', '+frag)}
      else{
        var prev=etapas[i-1];
        partes.push((prev.saida==='condicional'&&prev.condicao?('Se '+prev.condicao+', '):'Em seguida, ')+frag);
      }
    });
    var ultimo=etapas[etapas.length-1],fecho='.';
    if(ultimo.saida==='para')fecho='. Depois, a rotina para e avisa você.';
    else if(ultimo.saida==='condicional'&&ultimo.condicao)fecho='. Se '+ultimo.condicao+', ela segue; senão, para e avisa você.';
    return partes.join('. ')+fecho+(obs?' '+obs:'');
  }

  var ROTINAS=[
    {id:'r1',nome:'Captação contínua',ativa:true,freq:'semanal',rodou:7,proxima:'segunda, 10 ago',tetoGlobalMes:150,
     etapas:[
       {agente:'rico',atividade:'procurar oportunidades',teto:1,saida:'condicional',condicao:'achar algo acima de 70% de aderência'},
       {agente:'iris',atividade:'diagnosticar o potencial',teto:5,saida:'condicional',condicao:'o potencial for alto'},
       {agente:'kai',atividade:'validar o problema-solução',teto:10,saida:'segue'},
       {agente:'ada',atividade:'elaborar o projeto',teto:20,saida:'para'}
     ]},
    {id:'r2',nome:'Ciclo estratégico',ativa:true,freq:'bimestral',rodou:1,proxima:'1 out',tetoGlobalMes:50,
     obs:'O Kai só roda se eu pedir.',
     etapas:[
       {agente:'aurora',atividade:'atualizar o discovery estratégico',teto:15,saida:'segue'},
       {agente:'barto',atividade:'revisar a viabilidade do negócio',teto:15,saida:'segue'},
       {agente:'romeu',atividade:'pesquisar novas aplicações e atualizar o roadmap',teto:15,saida:'segue'}
     ]},
    {id:'r3',nome:'Busca de parceiros',ativa:false,freq:'mensal',rodou:3,proxima:null,tetoGlobalMes:20,
     etapas:[
       {agente:'eros',atividade:'buscar parceiros compatíveis',teto:5,saida:'segue'}
     ]}
  ];

  /* ================= Motor de sugestão de etapas (v29) =================
     Alimenta "+ Adicionar etapa" (1 sugestão) e "Sugerir o restante" (várias,
     em loop, cada chamada vendo o resultado da anterior). Duas fontes, nessa
     ordem de preferência:
     1. Biblioteca de sequências conhecidas (as 3 rotinas de exemplo + os 4
        "modelos prontos" da regra 20.8 do doc 06, nunca antes construídos
        como rotina de verdade). Se tudo que o usuário já montou bate com o
        início de alguma sequência da biblioteca, usa o próximo passo dela —
        já testado, já com teto/saída sensatos, não é chute.
     2. Sem bater com nenhuma: heurística por grupo (Descobrir → Decidir →
        Construir → Depois da submissão, seção 2.2 do doc 06). Olha o grupo
        do último agente da rotina e sugere o próximo agente não usado desse
        grupo; esgotado, avança pro grupo seguinte.
     Nunca sugere depois de uma etapa que já "para e avisa" — isso encerra a
     rotina, sugerir mais depois seria sugerir um trecho que nunca roda. */
  var ROT_GRUPOS_ORDEM=['descobrir','decidir','construir','pos'];
  var ROT_GRUPO_DE={rico:'descobrir',aurora:'descobrir',romeu:'descobrir',mike:'descobrir',
    iris:'decidir',kai:'decidir',barto:'decidir',
    eros:'construir',ada:'construir',carlito:'construir',banca:'construir',laura:'construir',
    clara:'pos',rui:'pos'};
  var ROT_GRUPO_AGENTES={descobrir:['rico','aurora','romeu','mike'],decidir:['iris','kai','barto'],
    construir:['eros','ada','carlito','banca','laura'],pos:['clara','rui']};

  /* As 3 primeiras reaproveitam ROTINAS por referência — nunca duplicar dados
     que já existem, ou listagem e motor de sugestão podem um dia divergir.
     As 4 seguintes são os "modelos prontos" da regra 20.8, que só existiam
     como ideia até agora — viram sequência de referência para a sugestão
     mesmo sem terem uma rotina real ativa no piloto. */
  var ROT_TEMPLATES=[
    {nome:ROTINAS[0].nome,etapas:ROTINAS[0].etapas},
    {nome:ROTINAS[1].nome,etapas:ROTINAS[1].etapas},
    {nome:ROTINAS[2].nome,etapas:ROTINAS[2].etapas},
    {nome:'Radar semanal',etapas:[
      {agente:'rico',atividade:'procurar oportunidades',teto:1,saida:'segue'}
    ]},
    {nome:'Do zero ao projeto',etapas:[
      {agente:'iris',atividade:'diagnosticar o potencial',teto:5,saida:'condicional',condicao:'o potencial for alto'},
      {agente:'kai',atividade:'validar o problema-solução',teto:10,saida:'segue'},
      {agente:'ada',atividade:'elaborar o projeto',teto:20,saida:'para'}
    ]},
    {nome:'Inovação contínua',etapas:[
      {agente:'romeu',atividade:'pesquisar novas aplicações e atualizar o roadmap',teto:15,saida:'segue'},
      {agente:'aurora',atividade:'atualizar o discovery estratégico',teto:15,saida:'para'}
    ]},
    {nome:'Pronto para submeter',etapas:[
      {agente:'banca',atividade:'avaliar o projeto antes da submissão',teto:10,saida:'segue'},
      {agente:'carlito',atividade:'montar o checklist documental',teto:5,saida:'segue'},
      {agente:'laura',atividade:'criar o roteiro do pitch',teto:5,saida:'para'}
    ]}
  ];

  function clonarEtapa(e){return {agente:e.agente,atividade:e.atividade,teto:e.teto,saida:e.saida,condicao:e.condicao||''}}
  function rotCustoPadrao(agente){
    var a=AGD.filter(function(x){return x.k===agente})[0];
    var n=a?parseInt(String(a.cost).replace(/[^\d]/g,''),10):NaN;
    return isNaN(n)?5:n;
  }
  /* Entre as sequências que cobrem 100% do que já foi montado, prefere a
     mais longa — é a que sobra mais passo pra sugerir. */
  function rotMelhorTemplate(etapasAtuais){
    var melhor=null;
    ROT_TEMPLATES.forEach(function(t){
      var i=0;
      while(i<etapasAtuais.length&&i<t.etapas.length&&etapasAtuais[i].agente===t.etapas[i].agente)i++;
      var cobreTudo=(i===etapasAtuais.length)&&(t.etapas.length>i);
      if(cobreTudo&&(!melhor||t.etapas.length>melhor.etapas.length))melhor=t;
    });
    return melhor;
  }
  /* O que já foi montado bate, do início ao fim, com uma sequência conhecida
     inteira? Então ela está completa — mesmo que a última etapa dessa
     sequência não seja "para e me avisa" (Ciclo estratégico termina em
     "continua sempre" de propósito). Sem este corte, rotSugerirProximaEtapa
     não via motivo pra parar e caía na heurística por grupo, emendando uma
     sequência sem relação nenhuma logo depois de um template já fechado. */
  function rotBateTemplateExato(etapasAtuais){
    return ROT_TEMPLATES.some(function(t){
      return t.etapas.length===etapasAtuais.length&&
        t.etapas.every(function(e,i){return e.agente===etapasAtuais[i].agente});
    });
  }
  function rotSugerirProximaEtapa(etapasAtuais){
    if(etapasAtuais.length&&etapasAtuais[etapasAtuais.length-1].saida==='para')return null;
    var tmpl=rotMelhorTemplate(etapasAtuais);
    if(tmpl)return clonarEtapa(tmpl.etapas[etapasAtuais.length]);
    if(rotBateTemplateExato(etapasAtuais))return null;
    var usados={};etapasAtuais.forEach(function(e){usados[e.agente]=1});
    var grupoAtual=etapasAtuais.length?ROT_GRUPO_DE[etapasAtuais[etapasAtuais.length-1].agente]:'descobrir';
    var idxGrupo=ROT_GRUPOS_ORDEM.indexOf(grupoAtual);
    for(var g=idxGrupo;g<ROT_GRUPOS_ORDEM.length;g++){
      var candidatos=ROT_GRUPO_AGENTES[ROT_GRUPOS_ORDEM[g]].filter(function(a){return !usados[a]});
      if(candidatos.length){
        var agente=candidatos[0];
        return {agente:agente,atividade:ROT_ATIVIDADES[agente][0],teto:rotCustoPadrao(agente),saida:'segue',condicao:''};
      }
    }
    return null;
  }

  function renderRotinas(){
    var box=$('#rotinasLista'); if(!box)return;
    box.innerHTML=ROTINAS.map(function(r){
      var etapas=r.etapas||[];
      var agentes=rotAgentesUnicos(etapas);
      var teto=rotTetoTotal(etapas);
      var frase=rotFraseHTML(r.freq,etapas,r.obs);
      var pontos=agentes.map(function(a){
        return '<i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:var(--c-'+a+')"></i>';
      }).join(' ');
      return '<article class="v29-rot'+(r.ativa?'':' off-state')+'">'+
        '<span class="v29-rot-status'+(r.ativa?'':' off')+'"></span>'+
        '<span><b class="v29-rot-nome">'+r.nome+'</b>'+
          '<span class="v29-rot-frase">'+frase+'</span>'+
          '<span class="v29-rot-meta">'+
            '<span>'+pontos+' '+agentes.length+' agente'+(agentes.length>1?'s':'')+'</span>'+
            (r.ativa&&r.proxima?'<span>próxima: <span class="n">'+r.proxima+'</span></span>':'')+
            '<span>até <span class="n">'+teto+' fichas</span> por execução</span>'+
            '<span>rodou <span class="n">'+r.rodou+'×</span></span>'+
          '</span></span>'+
        '<span class="v29-rot-acoes">'+
          '<label class="rot-switch'+(r.ativa?' on':'')+'">'+
            '<input type="checkbox" data-rot-toggle="'+r.id+'"'+(r.ativa?' checked':'')+
              ' aria-label="'+(r.ativa?'Pausar':'Ativar')+' a rotina '+r.nome+'">'+
            '<span class="track-sw"></span><span class="thumb"></span>'+
            '<span class="rot-switch-lbl">'+(r.ativa?'Ativa':'Pausada')+'</span>'+
          '</label>'+
          '<button class="btn-ghost" type="button" data-rot-edit="'+r.id+'">Editar</button>'+
        '</span>'+
      '</article>';
    }).join('');
  }
  $('#rotinasLista').addEventListener('click',function(e){
    var edBtn=e.target.closest('[data-rot-edit]');
    if(edBtn)openRotEd(edBtn.getAttribute('data-rot-edit'));
  });
  /* O liga/desliga virou <input type="checkbox"> (switch), então o evento é
     'change', não 'click' — assim funciona igual por mouse, toque e teclado
     (Espaço), sem precisar tratar cada um. */
  $('#rotinasLista').addEventListener('change',function(e){
    var cb=e.target.closest('[data-rot-toggle]'); if(!cb)return;
    var r=ROTINAS.filter(function(x){return x.id===cb.getAttribute('data-rot-toggle')})[0];
    if(!r)return;
    r.ativa=cb.checked;
    renderRotinas();
    toast(r.ativa?('"'+r.nome+'" ativada — roda '+rotFreqInfo(r.freq).label.toLowerCase()+'. (demo)'):('"'+r.nome+'" pausada. Nada em andamento é interrompido — só as próximas execuções não iniciam. (demo)'));
  });
  $('#btnNovaRotina').addEventListener('click',function(){openRotEd(null)});

  /* ================= Editor de Rotina — Criar/Editar (v29) =================
     Um componente, dois modos: rotEdState.id nulo = criar. A frase e a
     projeção de custo são recalculadas a cada mudança de campo — nunca ficam
     desatualizadas em relação às etapas reais (mesma regra da seção 20.3 do
     doc 06: a rotina é a frase, a lista de etapas é só a forma de editá-la). */
  var rotEd=$('#rotEd');
  var rotEdState={id:null,nome:'',freq:'semanal',etapas:[],obs:'',tetoGlobalMes:50};

  $('#rotEdFreq').innerHTML=ROT_FREQS.map(function(f){
    return '<option value="'+f.k+'">'+f.label+'</option>';
  }).join('');

  /* Não é mais "em branco": usa o motor de sugestão (rotSugerirProximaEtapa)
     olhando pro que já existe em rotEdState.etapas — por isso precisa ser
     chamada DEPOIS que rotEdState já reflete o estado atual. Mantém um
     retorno fixo só como rede de segurança, caso ROT_TEMPLATES algum dia
     fique vazio. */
  function rotProximaEtapaOuPadrao(etapasAtuais){
    return rotSugerirProximaEtapa(etapasAtuais)||
      {agente:'rico',atividade:ROT_ATIVIDADES.rico[0],teto:5,saida:'segue',condicao:''};
  }

  function renderRotEdSteps(){
    var box=$('#rotEdSteps');
    box.innerHTML=rotEdState.etapas.map(function(e,i){
      var ativOpts=(ROT_ATIVIDADES[e.agente]||['']).map(function(a){
        return '<option value="'+a+'"'+(a===e.atividade?' selected':'')+'>'+a+'</option>';
      }).join('');
      var agOpts=Object.keys(ROT_ATIVIDADES).map(function(k){
        return '<option value="'+k+'"'+(k===e.agente?' selected':'')+'>'+nomeAgente(k)+'</option>';
      }).join('');
      return '<div class="etapa" data-idx="'+i+'" style="--ac:var(--c-'+e.agente+')">'+
        '<span class="et-num">'+(i+1)+'</span>'+
        '<div class="et-corpo">'+
          '<div class="et-linha1">'+
            '<i class="et-agente-dot" aria-hidden="true"></i>'+
            '<select class="et-select et-agente" data-field="agente" aria-label="Agente da etapa '+(i+1)+'">'+agOpts+'</select>'+
            '<span class="et-fazendo">vai</span>'+
            '<select class="et-select" data-field="atividade" aria-label="Atividade da etapa '+(i+1)+'">'+ativOpts+'</select>'+
            '<span class="et-fazendo">até</span>'+
            '<span class="campo et-teto-wrap"><input type="number" class="et-teto-input" data-field="teto" min="1" value="'+e.teto+'" aria-label="Teto de fichas da etapa '+(i+1)+'"> ficha'+(parseInt(e.teto,10)===1?'':'s')+'</span>'+
          '</div>'+
          '<div class="et-depois">'+
            '<span>e depois</span>'+
            '<select class="et-select" data-field="saida" aria-label="O que acontece depois da etapa '+(i+1)+'">'+
              '<option value="segue"'+(e.saida==='segue'?' selected':'')+'>continua sempre</option>'+
              '<option value="condicional"'+(e.saida==='condicional'?' selected':'')+'>só continua se…</option>'+
              '<option value="para"'+(e.saida==='para'?' selected':'')+'>para e me avisa</option>'+
            '</select>'+
            '<input type="text" class="et-condicao-input" data-field="condicao" value="'+(e.condicao||'').replace(/"/g,'&quot;')+'" placeholder="ex.: achar algo acima de 70% de aderência" style="display:'+(e.saida==='condicional'?'':'none')+'">'+
          '</div>'+
        '</div>'+
        '<div class="et-acoes">'+
          '<button type="button" class="et-mv" data-mover="up" aria-label="Mover etapa '+(i+1)+' para cima"'+(i===0?' disabled':'')+'>▲</button>'+
          '<button type="button" class="et-mv" data-mover="down" aria-label="Mover etapa '+(i+1)+' para baixo"'+(i===rotEdState.etapas.length-1?' disabled':'')+'>▼</button>'+
          '<button type="button" class="et-rm" data-remover aria-label="Remover etapa '+(i+1)+'">✕</button>'+
        '</div>'+
      '</div>';
    }).join('');
  }

  function updateRotEdPreview(){
    var teto=rotTetoTotal(rotEdState.etapas);
    var freqInfo=rotFreqInfo(rotEdState.freq);
    var execMes=freqInfo.execMes;
    var projecaoMes=Math.round(teto*execMes);
    $('#rotEdPreview').innerHTML=rotFraseHTML(rotEdState.freq,rotEdState.etapas,rotEdState.obs);
    $('#rotEdWhen').textContent='roda '+freqInfo.label.toLowerCase();
    $('#rotEdCustoExec').textContent=teto;
    $('#rotEdExecMes').textContent=execMes;
    var tetoInput=$('#rotEdTetoGlobal');
    if(document.activeElement!==tetoInput)tetoInput.value=rotEdState.tetoGlobalMes;
    var estourou=execMes>0&&projecaoMes>rotEdState.tetoGlobalMes;
    var pct=rotEdState.tetoGlobalMes>0?Math.min(100,Math.round(projecaoMes/rotEdState.tetoGlobalMes*100)):0;
    $('#rotEdBarraTeto').style.width=pct+'%';
    $('#rotEdBarraTetoWrap').className='barra-teto'+(estourou?' alerta':'');
    $('#rotEdProjAviso').innerHTML=execMes>0
      ? ('No pior caso esta rotina usa <b>'+projecaoMes+' das suas '+rotEdState.tetoGlobalMes+' fichas do mês</b>. '+
         'Ela pausa sozinha ao bater o teto e pede sua confirmação para continuar — nunca passa do combinado. '+
         'Se uma etapa parar antes (por exemplo, uma saída condicional não se confirmar), o gasto é menor.')
      : 'Rotina manual — só consome fichas quando você mesmo rodar cada etapa.';

    var btnSug=$('#rotEdSuggestRest');
    var haSugestao=!!rotSugerirProximaEtapa(rotEdState.etapas);
    btnSug.disabled=!haSugestao;
    btnSug.title=haSugestao?'':'A sequência já parece completa — não há um próximo passo óbvio para sugerir';
  }

  function openRotEd(id){
    var r=id?ROTINAS.filter(function(x){return x.id===id})[0]:null;
    if(r){
      rotEdState={id:r.id,nome:r.nome,freq:r.freq,obs:r.obs||'',tetoGlobalMes:r.tetoGlobalMes||50,
        etapas:r.etapas.map(function(e){return {agente:e.agente,atividade:e.atividade,teto:e.teto,saida:e.saida,condicao:e.condicao||''}})};
    }else{
      rotEdState={id:null,nome:'',freq:'semanal',obs:'',tetoGlobalMes:50,etapas:[rotProximaEtapaOuPadrao([])]};
    }
    $('#rotEdNome').value=rotEdState.nome;
    $('#rotEdFreq').value=rotEdState.freq;
    $('#rotEdObs').value=rotEdState.obs;
    $('#rotEdSave').textContent=r?'Salvar alterações':'Ativar rotina';
    renderRotEdSteps();
    updateRotEdPreview();
    rotEd.classList.add('open');
    document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';
    $('#rotEdNome').focus();
  }
  function closeRotEd(){
    rotEd.classList.remove('open');
    document.body.style.overflow='';document.documentElement.style.overflow='';
  }

  $('#rotEdNome').addEventListener('input',function(){rotEdState.nome=this.value});
  $('#rotEdFreq').addEventListener('change',function(){rotEdState.freq=this.value;updateRotEdPreview()});
  $('#rotEdObs').addEventListener('input',function(){rotEdState.obs=this.value;updateRotEdPreview()});
  $('#rotEdTetoGlobal').addEventListener('input',function(){
    rotEdState.tetoGlobalMes=Math.max(1,parseInt(this.value,10)||1);updateRotEdPreview();
  });
  $('#rotEdAdd').addEventListener('click',function(){
    rotEdState.etapas.push(rotProximaEtapaOuPadrao(rotEdState.etapas));renderRotEdSteps();updateRotEdPreview();
  });
  /* "Sugerir o restante": chama o motor em loop, cada volta vendo o resultado
     da anterior — é o que faz um template de 4 passos completar corretamente
     mesmo já tendo 1 ou 2 etapas no lugar (a partir da 3ª chamada, o prefixo
     já bate com o template inteiro). Teto de 8 é só rede de segurança contra
     um loop sem fim; na prática nenhum template/heurística passa disso. */
  $('#rotEdSuggestRest').addEventListener('click',function(){
    var tmplNoInicio=rotMelhorTemplate(rotEdState.etapas);
    var add=0;
    while(rotEdState.etapas.length<8){
      var prox=rotSugerirProximaEtapa(rotEdState.etapas);
      if(!prox)break;
      rotEdState.etapas.push(prox);
      add++;
    }
    renderRotEdSteps();updateRotEdPreview();
    if(add===0){toast('A sequência já parece completa — nada óbvio para sugerir agora. (demo)');return}
    toast(add+' etapa'+(add>1?'s':'')+' sugerida'+(add>1?'s':'')+
      (tmplNoInicio?' com base em "'+tmplNoInicio.nome+'"':' a partir do que você já montou')+
      ' — revise antes de ativar. (demo)');
  });

  $('#rotEdSteps').addEventListener('change',function(e){
    var card=e.target.closest('.etapa'); if(!card)return;
    var i=parseInt(card.getAttribute('data-idx'),10);
    var field=e.target.getAttribute('data-field'); if(!field)return;
    var et=rotEdState.etapas[i];
    if(field==='agente'){
      et.agente=e.target.value;
      et.atividade=(ROT_ATIVIDADES[et.agente]||[''])[0];
      renderRotEdSteps();updateRotEdPreview();return;
    }
    if(field==='teto'){et.teto=Math.max(1,parseInt(e.target.value,10)||1);renderRotEdSteps();updateRotEdPreview();return}
    if(field==='saida'){
      et.saida=e.target.value;
      if(et.saida!=='condicional')et.condicao='';
      renderRotEdSteps();updateRotEdPreview();return;
    }
    et[field]=e.target.value;
    updateRotEdPreview();
  });
  $('#rotEdSteps').addEventListener('input',function(e){
    if(e.target.getAttribute('data-field')!=='condicao')return;
    var card=e.target.closest('.etapa'); if(!card)return;
    var i=parseInt(card.getAttribute('data-idx'),10);
    rotEdState.etapas[i].condicao=e.target.value;
    updateRotEdPreview();
  });
  $('#rotEdSteps').addEventListener('click',function(e){
    var mv=e.target.closest('[data-mover]');
    if(mv){
      var card=mv.closest('.etapa');
      var i=parseInt(card.getAttribute('data-idx'),10);
      var j=mv.getAttribute('data-mover')==='up'?i-1:i+1;
      if(j<0||j>=rotEdState.etapas.length)return;
      var tmp=rotEdState.etapas[i];rotEdState.etapas[i]=rotEdState.etapas[j];rotEdState.etapas[j]=tmp;
      renderRotEdSteps();updateRotEdPreview();return;
    }
    var rm=e.target.closest('[data-remover]');
    if(rm){
      var card2=rm.closest('.etapa');
      var i2=parseInt(card2.getAttribute('data-idx'),10);
      rotEdState.etapas.splice(i2,1);
      renderRotEdSteps();updateRotEdPreview();
    }
  });

  function saveRotina(){
    var nome=$('#rotEdNome').value.trim();
    if(!nome){toast('Dê um nome para a rotina antes de continuar. (demo)');$('#rotEdNome').focus();return}
    if(!rotEdState.etapas.length){toast('Adicione ao menos 1 etapa. (demo)');return}
    for(var i=0;i<rotEdState.etapas.length;i++){
      var e=rotEdState.etapas[i];
      if(!e.agente||!e.atividade||!(parseInt(e.teto,10)>0)){
        toast('Etapa '+(i+1)+': confira o agente, a atividade e o teto de fichas. (demo)');return;
      }
      if(e.saida==='condicional'&&!String(e.condicao||'').trim()){
        toast('Etapa '+(i+1)+': descreva a condição de "só continua se…". (demo)');return;
      }
    }
    var existente=rotEdState.id?ROTINAS.filter(function(x){return x.id===rotEdState.id})[0]:null;
    if(existente){
      existente.nome=nome;existente.freq=rotEdState.freq;existente.obs=rotEdState.obs;
      existente.tetoGlobalMes=rotEdState.tetoGlobalMes;existente.etapas=rotEdState.etapas;
    }else{
      ROTINAS.push({id:'r'+Date.now(),nome:nome,ativa:true,freq:rotEdState.freq,rodou:0,proxima:null,
        tetoGlobalMes:rotEdState.tetoGlobalMes,obs:rotEdState.obs,etapas:rotEdState.etapas});
    }
    renderRotinas();
    closeRotEd();
    toast((existente?('"'+nome+'" atualizada.'):('"'+nome+'" criada e ativada.'))+' (demo)');
  }
  $('#rotEdSave').addEventListener('click',saveRotina);
  $('#rotEdCancel').addEventListener('click',closeRotEd);
  $('#rotEdClose').addEventListener('click',closeRotEd);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&rotEd.classList.contains('open'))closeRotEd()});

  /* Atividade - o controle mestre so oferece pausa quando existe etapa que ainda
     nao comecou. Etapa em execucao ja consome token e sera cobrada. */
  function renderAtividade(){
    var mestre=$('#atividadeMestre'), lista=$('#atividadeLista');
    if(!mestre||!lista)return;
    var pausaveis=2, consumido=16, aPreservar=30;
    mestre.innerHTML = pausaveis>0
      ? '<section class="v29-mestre">'+
          '<span class="v29-rot-status"></span>'+
          '<div><b style="display:block">Rotina "Captacao continua" em andamento</b>'+
          '<span style="font-size:var(--fs-sm);color:var(--text-3)">etapa 3 de 5 &middot; '+
          '<b>'+consumido+'</b> fichas ja consumidas &middot; <b>'+aPreservar+'</b> ainda nao</span></div>'+
          '<button class="btn-ghost">Pausar as proximas etapas</button>'+
          '<p class="v29-mestre-nota"><b>So e possivel parar o que ainda nao comecou.</b> '+
          'O Kai esta executando agora e o consumo dele ja esta em curso - sera cobrado mesmo se '+
          'voce pausar. As '+pausaveis+' etapas seguintes ('+aPreservar+' fichas) ainda nao iniciaram.</p>'+
        '</section>'
      : '<section class="v29-mestre sem-pausa">'+
          '<span class="v29-rot-status off"></span>'+
          '<div><b style="display:block">Nada a pausar agora</b>'+
          '<span style="font-size:var(--fs-sm);color:var(--text-3)">todas as etapas ja comecaram</span></div>'+
          '<button class="btn-ghost" disabled>Nada a pausar</button>'+
        '</section>';

    var eventos=[
      {ag:'iris',txt:'<b>Iris</b> parou e esta esperando a sua decisao sobre o Hidrogenio verde',
       why:'O diagnostico ia custar 5 fichas e o seu teto para a Iris neste mes ja estava em 20 de 20.',
       origem:'pausou',origemTxt:'pausou e perguntou',custo:'0 fichas',quando:'hoje, 13:47'},
      {ag:'rico',txt:'<b>Rico</b> encontrou 3 oportunidades novas - a melhor com <b>92% de aderencia</b>',
       why:'Rodou sozinho porque voce deixou o radar no automatico, com scan semanal as segundas.',
       origem:'auto',origemTxt:'automatico',custo:'1 ficha',quando:'hoje, 08:12'},
      {ag:'ada',txt:'<b>Ada</b> deixou metodologia e cronograma em blocos prontos para copiar',
       why:'Voce pediu a elaboracao no dia 30. O texto fica aqui para voce revisar e colar no formulario do edital - a MonyU nao submete nada.',
       origem:'voce',origemTxt:'voce pediu',custo:'20 fichas',quando:'ontem, 11:05'}
    ];
    lista.innerHTML='<div class="card">'+eventos.map(function(e){
      return '<div class="v29-ev">'+
        '<svg class="av" aria-hidden="true"><use href="'+avatarHref(e.ag)+'"/></svg>'+
        '<span><span class="v29-ev-txt">'+e.txt+'</span>'+
          '<span class="v29-ev-why">'+e.why+'</span>'+
          '<span class="v29-origem '+e.origem+'">'+e.origemTxt+'</span></span>'+
        '<span style="text-align:right;white-space:nowrap">'+
          '<span style="font-size:var(--fs-sm);color:var(--text-2)">'+e.custo+'</span>'+
          '<span style="display:block;font-size:.66rem;color:var(--text-3);margin-top:2px">'+e.quando+'</span>'+
        '</span></div>';
    }).join('')+'</div>';
  }

  function renderResultados(){
    var box=$('#resultadosPainel'); if(!box)return;
    box.innerHTML=
      '<section class="v29-roi">'+
        '<div><span class="v29-roi-lbl">Captacao aprovada</span>'+
        '<span class="v29-roi-num">R$ 780 mil</span>'+
        '<p style="font-size:var(--fs-base);color:var(--text-2);margin-top:var(--sp-4);max-width:46ch;line-height:1.5">'+
        '1 projeto aprovado de 2 submetidos. O resultado saiu em <b>12 de junho</b>, para a chamada CNPq 26/2026.</p></div>'+
        '<div style="text-align:right">'+
          '<span style="font-size:var(--fs-xs);color:var(--text-3);display:block">investido na plataforma</span>'+
          '<span style="font-size:var(--fs-xl);font-weight:600;display:block">R$ 591</span>'+
          '<span style="font-size:var(--fs-xs);color:var(--text-3);display:block;margin-top:var(--sp-5)">retorno sobre o investido</span>'+
          '<span style="font-size:var(--fs-2xl);font-weight:600;color:var(--ok-text);display:block">1.320x</span>'+
        '</div>'+
      '</section>';
  }


  /* ================= Home v29 — estado, atividade e retorno =================
     Os tres blocos que a v28 nao tinha na Home. A ordem responde a sequencia de
     perguntas do usuario ao abrir a plataforma: "o que esta acontecendo agora?",
     "o que os agentes fizeram sem mim?" e "isso esta valendo a pena?". */

  /* Linha de estado: substitui os 3 banners que competiam por atencao na v28.
     Le o estado real (agente rodando + aprovacoes pendentes) e escolhe UMA frase. */
  function renderAgentsState(){
    var el=$('#agentsStateTxt'), box=$('#agentsState');
    if(!el||!box)return;
    var pend = (typeof APROVACOES!=='undefined' && APROVACOES) ? APROVACOES.length : 2;
    var rodando = 'rico';
    var partes=[];
    partes.push('<b>'+nomeAgente(rodando)+'</b> rodando agora');
    if(pend>0)partes.push(pend+' aprovaç'+(pend>1?'ões':'ão')+' esperando você');
    el.innerHTML=partes.join(' · ');
    var pulse=box.querySelector('.pulse');
    if(pulse)pulse.style.background = pend>0 ? 'var(--warn)' : 'var(--ok)';
  }
  function nomeAgente(id){
    var a=AGD.filter(function(x){return x.k===id})[0];
    return a?a.name:(id.charAt(0).toUpperCase()+id.slice(1));
  }

  /* Atividade recente: 3 ultimos eventos. Cada um traz a origem (automatico /
     voce pediu / pausou e perguntou) porque sem isso o modo automatico vira
     caixa preta — o erro mais comum em produto agentico. */
  var HOME_EVENTOS=[
    {ag:'iris',txt:'<b>Íris</b> parou e está esperando sua decisão sobre o Hidrogênio verde',
     why:'O diagnóstico ia custar 5 fichas e seu teto para a Íris neste mês já estava em 20 de 20.',
     org:'pausou',orgTxt:'pausou e perguntou',custo:'0 fichas',quando:'hoje, 13:47'},
    {ag:'rico',txt:'<b>Rico</b> encontrou 3 oportunidades novas — a melhor com <b>92% de aderência</b>',
     why:'Rodou sozinho porque você deixou o radar no automático, com varredura semanal às segundas.',
     org:'auto',orgTxt:'automático',custo:'1 ficha',quando:'hoje, 08:12'},
    {ag:'ada',txt:'<b>Ada</b> deixou metodologia e cronograma em blocos prontos para copiar',
     why:'Você pediu a elaboração no dia 30. O texto fica aqui para você revisar e colar no formulário — a MonyU não submete nada.',
     org:'voce',orgTxt:'você pediu',custo:'20 fichas',quando:'ontem, 11:05'}
  ];
  function renderHomeAtividade(){
    var box=$('#homeAtividade'); if(!box)return;
    box.innerHTML=HOME_EVENTOS.map(function(e){
      return '<div class="home-ev">'+
        '<svg class="av" aria-hidden="true"><use href="'+avatarHref(e.ag)+'"/></svg>'+
        '<span><span class="home-ev-txt">'+e.txt+
          '<span class="home-ev-why">'+e.why+'</span></span><br>'+
          '<span class="home-ev-org '+e.org+'">'+e.orgTxt+'</span></span>'+
        '<span class="home-ev-meta">'+
          '<span class="home-ev-cost">'+e.custo+'</span>'+
          '<span class="home-ev-when">'+e.quando+'</span>'+
        '</span></div>';
    }).join('')+
    '<div class="home-auto-nota"><span>No automático desde 12 jul · '+
      '<b>21 fichas</b> consumidas nos últimos 7 dias · teto semanal de <b>40</b></span>'+
      '<span class="linklike" data-nav="atividade">ajustar limites</span></div>';
  }

  /* Retorno: 4 numeros, sem grafico. Grafico aqui sugeriria serie historica que a
     plataforma nao tem — o dado vem do que o usuario declara. */
  var HOME_ROI=[
    {n:'R$ 780 mil',l:'aprovado em 2026',good:true},
    {n:'R$ 591',l:'investido na plataforma'},
    {n:'1.320x',l:'retorno sobre o investido',good:true},
    {n:'1 de 2',l:'projetos submetidos aprovados'}
  ];
  function renderHomeRoi(){
    var box=$('#homeRoi'); if(!box)return;
    box.innerHTML=HOME_ROI.map(function(t){
      return '<div class="roi-tira"><span class="n'+(t.good?' good':'')+'">'+t.n+'</span>'+
        '<span class="l">'+t.l+'</span></div>';
    }).join('');
  }


  /* Um aviso por vez. A v28 podia mostrar 3 banners empilhados (358px antes do
     primeiro projeto) e o usuario nao sabia qual olhar. A ordem abaixo e a ordem
     de urgencia real: prazo primeiro, aprovacao depois. Aprovacao ja e anunciada
     na linha de estado do topo, entao ela so vira banner se for o unico aviso. */
  function priorizarAvisos(){
    var slots=$$('#view-inicio .aviso-slot'), achou=false;
    slots.forEach(function(el){
      var escondidoPeloUsuario = el.classList.contains('hidden') || el.dataset.dispensado==='1';
      if(escondidoPeloUsuario){el.style.display='none';return}
      if(achou){el.style.display='none';return}
      el.style.display='';
      achou=true;
    });
  }

  function renderHomeV29(){renderAgentsState();renderHomeAtividade();renderHomeRoi();priorizarAvisos()}

  /* Ponto de inspeção do motor de recomendação (v29). Só leitura, sem efeito na
     interface — existe para conferir a recomendação de qualquer combinação
     projeto × edital sem precisar navegar até ela. Ex. no console:
       __monyu.nextBestAction('p2','embrapii')  */
  window.__monyu={
    nextBestAction:nextBestAction,editalProfile:editalProfile,
    projects:PROJECTS,ran:PROJ_RAN,opps:OPPS,
    modoAtual:modoAtual,nivelDeUso:nivelDeUso,aplicarModo:aplicarModo,
    renderHomeV29:renderHomeV29,
    setModo:function(m){store.set('modoExposicao',m);return aplicarModo()}
  };

  /* Define data-modo no <html> — o CSS usa isso para abrir/fechar densidade
     sem que nenhuma tela precise saber que "modo" existe. */
  aplicarModo();
  renderOpps();
  renderNextBest();
  renderHomeV29();

  /* Aviso do modo de exposição: diz o que está recolhido e como abrir. Sem isso,
     o modo decidiria pelo usuário sem ele saber — o oposto de dar controle. */
  (function(){
    var hint=$('#modoHint'),txt=$('#modoHintTxt'),btn=$('#modoHintBtn');
    if(!hint)return;
    function sync(){
      var m=modoAtual();
      if(m>=3)return;
      txt.innerHTML=(m===1
        ? 'Mostrando só o essencial para você começar. <b>Os 14 agentes, o radar completo e o seu consumo</b> continuam disponíveis no menu ao lado.'
        : 'Seu resumo financeiro está recolhido nesta página. <b>Fichas &amp; plano</b> segue completo no menu ao lado.');
    }
    sync();
    btn.addEventListener('click',function(){
      setModoManual('avancado');
      toast('Página inicial completa. Você pode voltar ao modo guiado em Configurações.');
    });
  })();

  /* ================= Animações ================= */
  syncSaldo();
  syncNavBadges(); /* garante que Meus projetos/Oportunidades/Memória no menu nascem corretos — 0 no modo conta nova, reais no modo demo */
  requestAnimationFrame(function(){
    setTimeout(function(){
      $$('.match .val').forEach(function(c){
        var pct=parseInt(c.getAttribute('data-pct'),10);
        c.style.transition='stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)';
        c.style.strokeDashoffset=(131.9*(1-pct/100)).toFixed(1);
      });
    },300);
  });
})();