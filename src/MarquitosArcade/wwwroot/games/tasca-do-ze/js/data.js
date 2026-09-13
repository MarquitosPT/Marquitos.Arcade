// Catálogo da tasca: ingredientes, pratos e clientes.
//
// É só dados — nenhuma lógica — para dar para acrescentar um prato novo sem
// mexer em código. As chaves dos ingredientes são as que aparecem no `req` de
// cada prato e no `data-key` dos botões da bancada.
//
// `sweet` marca o que pertence à bancada dos doces: separa a bancada em dois
// separadores e evita que a lista de ingredientes fique impossível de percorrer.

export const INGREDIENTS = {
  pao:            {ico:'🍞', lbl:'Pão', sweet:false},
  carne:          {ico:'🥩', lbl:'Carne de hambúrguer', sweet:false},
  queijo:         {ico:'🧀', lbl:'Queijo', sweet:false},
  alface:         {ico:'🥬', lbl:'Alface', sweet:false},
  tomate:         {ico:'🍅', lbl:'Tomate', sweet:false},
  massa:          {ico:'🫓', lbl:'Massa de pizza', sweet:false},
  molho_tomate:   {ico:'🥫', lbl:'Molho de tomate', sweet:false},
  fiambre:        {ico:'🥓', lbl:'Fiambre', sweet:false},
  bacalhau:       {ico:'🐟', lbl:'Bacalhau', sweet:false},
  batata:         {ico:'🥔', lbl:'Batata cozida', sweet:false},
  cebola:         {ico:'🧅', lbl:'Cebola', sweet:false},
  ovo:            {ico:'🥚', lbl:'Ovo', sweet:false},
  esparguete:     {ico:'🍝', lbl:'Esparguete', sweet:false},
  molho_bolonhesa:{ico:'🥘', lbl:'Molho bolonhesa', sweet:false},
  picanha:        {ico:'🍖', lbl:'Picanha', sweet:false},
  arroz:          {ico:'🍚', lbl:'Arroz', sweet:false},
  batata_frita:   {ico:'🍟', lbl:'Batata frita', sweet:false},
  bife:           {ico:'🥩', lbl:'Bife', sweet:false},
  ovo_estrelado:  {ico:'🍳', lbl:'Ovo estrelado', sweet:false},
  salsicha:       {ico:'🌭', lbl:'Salsicha', sweet:false},
  molho_francesinha:{ico:'🍺', lbl:'Molho de francesinha', sweet:false},
  frango:         {ico:'🍗', lbl:'Frango assado', sweet:false},
  camarao:        {ico:'🍤', lbl:'Camarão', sweet:false},
  azeitona:       {ico:'🫒', lbl:'Azeitonas', sweet:false},
  leite:          {ico:'🥛', lbl:'Leite', sweet:true},
  acucar:         {ico:'🍯', lbl:'Açúcar', sweet:true},
  caramelo:       {ico:'🍮', lbl:'Caramelo', sweet:true},
  canela:         {ico:'🍂', lbl:'Canela', sweet:true},
  chocolate:      {ico:'🍫', lbl:'Chocolate', sweet:true},
  natas:          {ico:'🧈', lbl:'Natas', sweet:true},
  morango:        {ico:'🍓', lbl:'Morango', sweet:true},
  coco:           {ico:'🥥', lbl:'Coco', sweet:true},
  maca:           {ico:'🍎', lbl:'Maçã', sweet:true},
  banana:         {ico:'🍌', lbl:'Banana', sweet:true},
  noz:            {ico:'🌰', lbl:'Nozes', sweet:true},
  bolacha:        {ico:'🍪', lbl:'Bolacha triturada', sweet:true}
};

export const MAINS = [
  {id:'hamburguer', name:'Hambúrguer', emoji:'🍔', req:['pao','carne','queijo','alface','tomate']},
  {id:'pizza', name:'Pizza', emoji:'🍕', req:['massa','molho_tomate','queijo','fiambre']},
  {id:'bacalhau', name:'Bacalhau à Gomes Sá', emoji:'🐟', req:['bacalhau','batata','cebola','ovo']},
  {id:'esparguete', name:'Esparguete à Bolonhesa', emoji:'🍝', req:['esparguete','molho_bolonhesa','queijo']},
  {id:'tosta', name:'Tosta Mista', emoji:'🥪', req:['pao','fiambre','queijo']},
  {id:'picanha', name:'Picanha, Arroz e Batata Frita', emoji:'🍽️', req:['picanha','arroz','batata_frita']},
  {id:'bitoque', name:'Bitoque', emoji:'🍳', req:['bife','ovo_estrelado','arroz','batata_frita']},
  {id:'francesinha', name:'Francesinha', emoji:'🥙', req:['pao','fiambre','salsicha','queijo','molho_francesinha']},
  {id:'frango_arroz', name:'Frango Assado com Arroz e Azeitonas', emoji:'🍗', req:['frango','arroz','azeitona']},
  {id:'camarao_alho', name:'Camarão à Guilho', emoji:'🍤', req:['camarao','pao','azeitona']}
];

export const DESSERTS = [
  {id:'pudim', name:'Pudim Flan', emoji:'🍮', req:['ovo','leite','acucar','caramelo'], sweet:true},
  {id:'arrozdoce', name:'Arroz Doce', emoji:'🍚', req:['arroz','leite','acucar','canela'], sweet:true},
  {id:'mousse', name:'Mousse de Chocolate', emoji:'🍫', req:['chocolate','natas','ovo','acucar'], sweet:true},
  {id:'bolo_coco', name:'Bolo de Coco', emoji:'🥥', req:['coco','ovo','acucar','leite'], sweet:true},
  {id:'morangos_natas', name:'Morangos com Natas', emoji:'🍓', req:['morango','natas','acucar'], sweet:true},
  {id:'tarte_maca', name:'Tarte de Maçã', emoji:'🥧', req:['maca','acucar','canela'], sweet:true},
  {id:'bolo_banana', name:'Bolo de Banana', emoji:'🍌', req:['banana','acucar','ovo','leite'], sweet:true},
  {id:'salame_chocolate', name:'Salame de Chocolate', emoji:'🍫', req:['bolacha','chocolate','natas'], sweet:true},
  {id:'bolo_noz', name:'Bolo de Nozes', emoji:'🌰', req:['noz','acucar','ovo','leite'], sweet:true}
];

export const ALL_DISHES = MAINS.concat(DESSERTS);

export const CUSTOMERS = [
  {name:'Sr. António', e:'👴'}, {name:'D. Fernanda', e:'👵'}, {name:'Sr. Manuel', e:'🧔'},
  {name:'D. Rosa', e:'👩'}, {name:'Sr. Zé', e:'👨'}, {name:'D. Célia', e:'👩‍🦱'},
  {name:'Sr. Joaquim', e:'🧑‍🦳'}, {name:'D. Aida', e:'👵'}, {name:'Sr. Tozé', e:'🧑'},
  {name:'D. Lurdes', e:'👩‍🦳'}
];
