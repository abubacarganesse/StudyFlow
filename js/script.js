/* ==========================================================
   StudyFlow · script.js
   ========================================================== */

/* ----- ELEMENTOS PRINCIPAIS ----- */

const cabecalho = document.querySelector('.cabecalho');
const menu = document.querySelector('.menu_item');
const links = document.querySelectorAll('.link-menu');
const secoes = document.querySelectorAll('.secao');
const aviso = document.getElementById('aviso');

/* ----- ARMAZENAMENTO LOCAL ----- */

const CHAVE_TAREFAS = 'studyflow_tarefas';
const CHAVE_RECURSOS = 'studyflow_recursos';
const CHAVE_PERFIL = 'studyflow_perfil';

const NOMES_PRIORIDADE = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const PESO_PRIORIDADE = { alta: 0, media: 1, baixa: 2 };

// Lê uma lista do localStorage. Se não existir ou estiver corrompida, devolve [].
function ler_lista(chave) {
  try {
    const dados = JSON.parse(localStorage.getItem(chave));
    return Array.isArray(dados) ? dados : [];
  } catch (erro) {
    return [];
  }
}

function ler_perfil() {
  const padrao = { nome: '', curso: '', instituicao: '' };
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE_PERFIL));
    if (dados && typeof dados === 'object') {
      return {
        nome: String(dados.nome || ''),
        curso: String(dados.curso || ''),
        instituicao: String(dados.instituicao || '')
      };
    }
  } catch (erro) {
    // ignora e devolve o padrão
  }
  return padrao;
}

function guardar_dados(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch (erro) {
    mostrar_aviso('Não foi possível guardar os dados neste navegador.', true);
    return false;
  }
}

function tarefa_valida(t) {
  return t && typeof t.id === 'string' && typeof t.titulo === 'string'
    && typeof t.disciplina === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(t.prazo);
}

function recurso_valido(r) {
  return r && typeof r.id === 'string' && typeof r.titulo === 'string'
    && typeof r.disciplina === 'string' && url_valido(r.url);
}

let tarefas = ler_lista(CHAVE_TAREFAS).filter(tarefa_valida).map(function (t) {
  return {
    id: t.id,
    titulo: t.titulo,
    descricao: typeof t.descricao === 'string' ? t.descricao : '',
    disciplina: t.disciplina,
    prazo: t.prazo,
    prioridade: NOMES_PRIORIDADE[t.prioridade] ? t.prioridade : 'media',
    concluida: Boolean(t.concluida)
  };
});

let recursos = ler_lista(CHAVE_RECURSOS).filter(recurso_valido).map(function (r) {
  return {
    id: r.id,
    titulo: r.titulo,
    disciplina: r.disciplina,
    descricao: typeof r.descricao === 'string' ? r.descricao : '',
    url: r.url
  };
});

let perfil = ler_perfil();
let tarefaEmEdicao = null; // tarefa a ser editada (null = nova tarefa)
let temporizadorAviso = null;

/* ----- FUNÇÕES AUXILIARES ----- */

function criar(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function criar_icone(nome) {
  return criar('span', 'icone icone-' + nome);
}

function criar_botao_icone(icone, rotulo, acao, id, perigo) {
  const botao = criar('button', 'botao_icone' + (perigo ? ' perigo' : ''));
  botao.type = 'button';
  botao.dataset.acao = acao;
  botao.dataset.id = id;
  botao.setAttribute('aria-label', rotulo);
  botao.title = rotulo;
  botao.appendChild(criar_icone(icone));
  return botao;
}

function gerar_id() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function url_valido(texto) {
  try {
    const endereco = new URL(texto);
    return endereco.protocol === 'http:' || endereco.protocol === 'https:';
  } catch (erro) {
    return false;
  }
}

function mostrar_aviso(texto, erro) {
  aviso.textContent = texto;
  aviso.classList.toggle('aviso_erro', Boolean(erro));
  aviso.classList.add('aviso_visivel');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(function () {
    aviso.classList.remove('aviso_visivel');
  }, 3000);
}

/* ----- DATAS ----- */

function formatar_iso(data) {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return data.getFullYear() + '-' + mes + '-' + dia;
}

function hoje_iso() {
  return formatar_iso(new Date());
}

function formatar_data(iso) {
  const partes = iso.split('-');
  return partes[2] + '/' + partes[1] + '/' + partes[0];
}

// Diferença em dias entre hoje e a data (negativo = já passou)
function dias_ate(iso) {
  const partes = iso.split('-').map(Number);
  const alvo = new Date(partes[0], partes[1] - 1, partes[2]);
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.round((alvo - hoje) / 86400000);
}

function descrever_prazo(tarefa) {
  const data = formatar_data(tarefa.prazo);
  if (tarefa.concluida) return { texto: data, classe: '' };

  const dias = dias_ate(tarefa.prazo);
  if (dias < 0) return { texto: data + ' (atrasada)', classe: 'etiqueta_alerta' };
  if (dias === 0) return { texto: 'Hoje', classe: 'etiqueta_aviso' };
  if (dias === 1) return { texto: 'Amanhã', classe: 'etiqueta_aviso' };
  return { texto: data, classe: '' };
}

/* ----- MENU E NAVEGAÇÃO ----- */

// Abre/fecha o menu (o cabeçalho esconde-se quando o menu está aberto, em ecrãs pequenos)
function alternar_menu() {
  menu.classList.toggle('escondido');
  cabecalho.classList.toggle('escondido');
  document.body.classList.toggle('menu_aberto', menu.classList.contains('escondido'));
}

// Obtém o id da secção a partir do href do link (ex: "#tarefas" -> "tarefas")
function obter_id_secao(link) {
  const a = link.matches('a') ? link : link.querySelector('a');
  return a.getAttribute('href').slice(1);
}

// Mostra a secção pedida e destaca o link correspondente
function mostrar_secao(id) {
  secoes.forEach(function (secao) {
    secao.classList.toggle('secao_ativa', secao.id === id);
  });

  links.forEach(function (link) {
    link.classList.toggle('link_ativo', obter_id_secao(link) === id);
  });

  window.scrollTo(0, 0);
}

function ir_para(id) {
  mostrar_secao(id);
  history.replaceState(null, '', '#' + id);
}

// Clique em qualquer opção do menu (o <li> inteiro é clicável)
links.forEach(function (link) {
  link.addEventListener('click', function (evento) {
    evento.preventDefault();
    ir_para(obter_id_secao(link));
    alternar_menu();
  });
});

document.getElementById('fundo_menu').addEventListener('click', alternar_menu);

document.addEventListener('keydown', function (evento) {
  if (evento.key === 'Escape' && menu.classList.contains('escondido')) {
    alternar_menu();
  }
});

document.getElementById('botao_perfil').addEventListener('click', function () {
  ir_para('perfil');
});

/* ----- DIÁLOGOS ----- */

document.querySelectorAll('dialog').forEach(function (dialogo) {
  // clicar no fundo escuro fecha o diálogo
  dialogo.addEventListener('click', function (evento) {
    if (evento.target === dialogo) dialogo.close();
  });

  dialogo.querySelectorAll('[data-fechar]').forEach(function (botao) {
    botao.addEventListener('click', function () {
      dialogo.close();
    });
  });
});

/* ----- VALIDAÇÃO DE FORMULÁRIOS ----- */

function limpar_erros(formulario) {
  formulario.querySelectorAll('.erro').forEach(function (e) {
    e.textContent = '';
  });
  formulario.querySelectorAll('[aria-invalid]').forEach(function (campo) {
    campo.removeAttribute('aria-invalid');
  });
}

// erros: objeto no formato { idDoCampo: 'mensagem' }
function mostrar_erros(formulario, erros) {
  limpar_erros(formulario);
  const ids = Object.keys(erros);

  ids.forEach(function (id) {
    const campo = document.getElementById(id);
    campo.setAttribute('aria-invalid', 'true');
    campo.closest('.campo').querySelector('.erro').textContent = erros[id];
  });

  if (ids.length > 0) document.getElementById(ids[0]).focus();
  return ids.length === 0;
}

/* ----- DISCIPLINAS ----- */

function todas_disciplinas() {
  const conjunto = new Set();
  tarefas.forEach(function (t) { conjunto.add(t.disciplina); });
  recursos.forEach(function (r) { conjunto.add(r.disciplina); });
  return Array.from(conjunto).sort(function (a, b) { return a.localeCompare(b, 'pt'); });
}

// Se a disciplina já existe (ignorando maiúsculas), reutiliza a mesma escrita
function normalizar_disciplina(nome) {
  const existente = todas_disciplinas().find(function (d) {
    return d.toLowerCase() === nome.toLowerCase();
  });
  return existente || nome;
}

function atualizar_lista_disciplinas() {
  const disciplinas = todas_disciplinas();

  const lista = document.getElementById('lista_disciplinas');
  lista.replaceChildren();
  disciplinas.forEach(function (d) {
    const opcao = document.createElement('option');
    opcao.value = d;
    lista.appendChild(opcao);
  });

  const filtro = document.getElementById('filtro_disciplina');
  const atual = filtro.value;
  filtro.replaceChildren(new Option('Todas as disciplinas', 'todas'));
  disciplinas.forEach(function (d) {
    filtro.appendChild(new Option(d, d));
  });
  filtro.value = disciplinas.includes(atual) ? atual : 'todas';
}

/* ----- TAREFAS: DADOS ----- */

function guardar_tarefas() {
  return guardar_dados(CHAVE_TAREFAS, tarefas);
}

function ordenar_tarefas(a, b) {
  if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
  if (a.prazo !== b.prazo) return a.prazo.localeCompare(b.prazo);
  return PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade];
}

function tarefas_filtradas() {
  const estado = document.getElementById('filtro_estado').value;
  const disciplina = document.getElementById('filtro_disciplina').value;
  const prioridade = document.getElementById('filtro_prioridade').value;

  return tarefas.filter(function (t) {
    if (estado === 'pendentes' && t.concluida) return false;
    if (estado === 'concluidas' && !t.concluida) return false;
    if (disciplina !== 'todas' && t.disciplina !== disciplina) return false;
    if (prioridade !== 'todas' && t.prioridade !== prioridade) return false;
    return true;
  }).sort(ordenar_tarefas);
}

function alternar_conclusao(id) {
  const tarefa = tarefas.find(function (t) { return t.id === id; });
  if (!tarefa) return;
  tarefa.concluida = !tarefa.concluida;
  guardar_tarefas();
  atualizar_tudo();
  mostrar_aviso(tarefa.concluida ? 'Tarefa concluída.' : 'Tarefa marcada como pendente.');
}

function eliminar_tarefa(id) {
  const tarefa = tarefas.find(function (t) { return t.id === id; });
  if (!tarefa) return;
  if (!confirm('Eliminar a tarefa "' + tarefa.titulo + '"?')) return;

  tarefas = tarefas.filter(function (t) { return t.id !== id; });
  guardar_tarefas();
  atualizar_tudo();
  mostrar_aviso('Tarefa eliminada.');
}

/* ----- TAREFAS: FORMULÁRIO ----- */

const dialogoTarefa = document.getElementById('dialogo_tarefa');
const formTarefa = document.getElementById('form_tarefa');

function abrir_form_tarefa(id) {
  limpar_erros(formTarefa);
  formTarefa.reset();
  tarefaEmEdicao = id ? tarefas.find(function (t) { return t.id === id; }) || null : null;

  const titulo = document.getElementById('titulo_dialogo_tarefa');

  if (tarefaEmEdicao) {
    titulo.textContent = 'Editar tarefa';
    document.getElementById('tarefa_titulo').value = tarefaEmEdicao.titulo;
    document.getElementById('tarefa_descricao').value = tarefaEmEdicao.descricao;
    document.getElementById('tarefa_disciplina').value = tarefaEmEdicao.disciplina;
    document.getElementById('tarefa_prazo').value = tarefaEmEdicao.prazo;
    document.getElementById('tarefa_prioridade').value = tarefaEmEdicao.prioridade;
  } else {
    titulo.textContent = 'Nova tarefa';
  }

  dialogoTarefa.showModal();
  document.getElementById('tarefa_titulo').focus();
}

function validar_tarefa(dados) {
  const erros = {};

  if (dados.titulo.length < 3) {
    erros.tarefa_titulo = 'Escreve um título com pelo menos 3 caracteres.';
  }

  if (dados.disciplina.length < 2) {
    erros.tarefa_disciplina = 'Indica a disciplina.';
  }

  if (!dados.prazo) {
    erros.tarefa_prazo = 'Define a data limite.';
  } else {
    // só rejeita datas passadas em tarefas novas ou quando a data foi alterada
    const dataAlterada = !tarefaEmEdicao || tarefaEmEdicao.prazo !== dados.prazo;
    if (dataAlterada && dados.prazo < hoje_iso()) {
      erros.tarefa_prazo = 'A data limite não pode estar no passado.';
    }
  }

  if (!NOMES_PRIORIDADE[dados.prioridade]) {
    erros.tarefa_prioridade = 'Escolhe uma prioridade.';
  }

  return erros;
}

formTarefa.addEventListener('submit', function (evento) {
  evento.preventDefault();

  const dados = {
    titulo: document.getElementById('tarefa_titulo').value.trim(),
    descricao: document.getElementById('tarefa_descricao').value.trim(),
    disciplina: document.getElementById('tarefa_disciplina').value.trim(),
    prazo: document.getElementById('tarefa_prazo').value,
    prioridade: document.getElementById('tarefa_prioridade').value
  };

  if (!mostrar_erros(formTarefa, validar_tarefa(dados))) return;

  dados.disciplina = normalizar_disciplina(dados.disciplina);

  if (tarefaEmEdicao) {
    Object.assign(tarefaEmEdicao, dados);
    mostrar_aviso('Tarefa atualizada.');
  } else {
    tarefas.push(Object.assign({ id: gerar_id(), concluida: false }, dados));
    mostrar_aviso('Tarefa criada.');
  }

  guardar_tarefas();
  dialogoTarefa.close();
  tarefaEmEdicao = null;
  atualizar_tudo();
});

document.getElementById('botao_nova_tarefa').addEventListener('click', function () {
  abrir_form_tarefa(null);
});

document.getElementById('atalho_nova_tarefa').addEventListener('click', function () {
  ir_para('tarefas');
  abrir_form_tarefa(null);
});

/* ----- TAREFAS: LISTA ----- */

const listaTarefas = document.getElementById('lista_tarefas');

function criar_cartao_tarefa(t) {
  const cartao = criar('article', 'cartao cartao_tarefa' + (t.concluida ? ' concluida' : ''));

  const topo = criar('div', 'tarefa_topo');

  const verificar = criar('button', 'botao_check');
  verificar.type = 'button';
  verificar.dataset.acao = 'concluir';
  verificar.dataset.id = t.id;
  verificar.setAttribute('aria-pressed', String(t.concluida));
  verificar.setAttribute('aria-label', t.concluida ? 'Marcar como pendente' : 'Marcar como concluída');
  verificar.appendChild(criar_icone('check'));

  const corpo = criar('div', 'tarefa_corpo');
  corpo.appendChild(criar('h3', 'tarefa_titulo', t.titulo));
  if (t.descricao) corpo.appendChild(criar('p', 'tarefa_descricao', t.descricao));

  topo.append(verificar, corpo);

  const etiquetas = criar('div', 'etiquetas');
  etiquetas.appendChild(criar('span', 'etiqueta', t.disciplina));

  const prazo = descrever_prazo(t);
  const etiquetaPrazo = criar('span', ('etiqueta ' + prazo.classe).trim());
  etiquetaPrazo.append(criar_icone('calendario'), prazo.texto);
  etiquetas.appendChild(etiquetaPrazo);

  etiquetas.appendChild(criar('span', 'etiqueta prioridade_' + t.prioridade,
    'Prioridade ' + NOMES_PRIORIDADE[t.prioridade].toLowerCase()));

  const acoes = criar('div', 'tarefa_acoes');
  acoes.append(
    criar_botao_icone('editar', 'Editar tarefa', 'editar', t.id, false),
    criar_botao_icone('eliminar', 'Eliminar tarefa', 'eliminar', t.id, true)
  );

  cartao.append(topo, etiquetas, acoes);
  return cartao;
}

function render_tarefas() {
  const lista = tarefas_filtradas();
  const vazio = document.getElementById('vazio_tarefas');

  listaTarefas.replaceChildren();
  lista.forEach(function (t) {
    listaTarefas.appendChild(criar_cartao_tarefa(t));
  });

  if (tarefas.length === 0) {
    vazio.textContent = 'Ainda não tens tarefas. Cria a primeira para começar.';
    vazio.hidden = false;
  } else if (lista.length === 0) {
    vazio.textContent = 'Nenhuma tarefa corresponde aos filtros escolhidos.';
    vazio.hidden = false;
  } else {
    vazio.hidden = true;
  }
}

// Um só ouvinte para os botões de todos os cartões
listaTarefas.addEventListener('click', function (evento) {
  const botao = evento.target.closest('button[data-acao]');
  if (!botao) return;

  const id = botao.dataset.id;
  if (botao.dataset.acao === 'concluir') alternar_conclusao(id);
  if (botao.dataset.acao === 'editar') abrir_form_tarefa(id);
  if (botao.dataset.acao === 'eliminar') eliminar_tarefa(id);
});

['filtro_estado', 'filtro_disciplina', 'filtro_prioridade'].forEach(function (id) {
  document.getElementById(id).addEventListener('change', render_tarefas);
});

/* ----- ESTATÍSTICAS ----- */

function calcular_estatisticas() {
  const total = tarefas.length;
  const concluidas = tarefas.filter(function (t) { return t.concluida; }).length;
  const pendentes = total - concluidas;
  const percentagem = total === 0 ? 0 : Math.round((concluidas / total) * 100);
  return { total: total, concluidas: concluidas, pendentes: pendentes, percentagem: percentagem };
}

function calcular_por_disciplina() {
  const mapa = new Map();
  tarefas.forEach(function (t) {
    if (!mapa.has(t.disciplina)) mapa.set(t.disciplina, { total: 0, concluidas: 0 });
    const item = mapa.get(t.disciplina);
    item.total++;
    if (t.concluida) item.concluidas++;
  });
  return Array.from(mapa.entries()).sort(function (a, b) {
    return a[0].localeCompare(b[0], 'pt');
  });
}

function render_estatisticas() {
  const est = calcular_estatisticas();
  const vazio = document.getElementById('vazio_estatisticas');
  const conteudo = document.getElementById('conteudo_estatisticas');

  vazio.hidden = est.total > 0;
  conteudo.hidden = est.total === 0;
  if (est.total === 0) return;

  document.getElementById('est_total').textContent = est.total;
  document.getElementById('est_concluidas').textContent = est.concluidas;
  document.getElementById('est_pendentes').textContent = est.pendentes;
  document.getElementById('est_percentagem').textContent = est.percentagem + '%';

  const lista = document.getElementById('lista_progresso_disciplinas');
  lista.replaceChildren();

  calcular_por_disciplina().forEach(function (entrada) {
    const nome = entrada[0];
    const dados = entrada[1];
    const percentagem = Math.round((dados.concluidas / dados.total) * 100);

    const item = criar('div', 'item_disciplina');
    const topo = criar('div', 'item_disciplina_topo');
    topo.append(
      criar('span', '', nome),
      criar('span', '', dados.concluidas + ' de ' + dados.total + ' (' + percentagem + '%)')
    );

    const barra = criar('div', 'barra');
    barra.setAttribute('role', 'progressbar');
    barra.setAttribute('aria-label', 'Progresso em ' + nome);
    barra.setAttribute('aria-valuemin', '0');
    barra.setAttribute('aria-valuemax', '100');
    barra.setAttribute('aria-valuenow', String(percentagem));
    const preenchida = criar('div', 'barra_preenchida');
    preenchida.style.width = percentagem + '%';
    barra.appendChild(preenchida);

    item.append(topo, barra);
    lista.appendChild(item);
  });
}

/* ----- PÁGINA INICIAL ----- */

function criar_saudacao() {
  const hora = new Date().getHours();
  let texto = 'Boa noite';
  if (hora < 12) texto = 'Bom dia';
  else if (hora < 19) texto = 'Boa tarde';

  const nome = perfil.nome.trim();
  return texto + (nome ? ', ' + nome : '') + '!';
}

function render_inicio() {
  const est = calcular_estatisticas();

  document.getElementById('saudacao').textContent = criar_saudacao();
  document.getElementById('inicio_pendentes').textContent = est.pendentes;
  document.getElementById('inicio_concluidas').textContent = est.concluidas;
  document.getElementById('inicio_percentagem').textContent = est.percentagem + '%';

  document.getElementById('inicio_barra').style.width = est.percentagem + '%';
  document.getElementById('inicio_barra_caixa').setAttribute('aria-valuenow', String(est.percentagem));

  document.getElementById('inicio_progresso_texto').textContent = est.total === 0
    ? 'Ainda não criaste tarefas. Cria a primeira para acompanhares o teu progresso.'
    : 'Concluíste ' + est.concluidas + ' de ' + est.total + ' tarefas.';

  // Próximos prazos: tarefas pendentes, da data mais próxima para a mais distante
  const proximas = tarefas
    .filter(function (t) { return !t.concluida; })
    .sort(ordenar_tarefas)
    .slice(0, 5);

  const lista = document.getElementById('lista_prazos');
  lista.replaceChildren();

  proximas.forEach(function (t) {
    const item = document.createElement('li');
    const info = criar('div', 'prazo_info');
    info.append(criar('strong', '', t.titulo), criar('span', '', t.disciplina));

    const prazo = descrever_prazo(t);
    const etiqueta = criar('span', ('etiqueta ' + prazo.classe).trim());
    etiqueta.append(criar_icone('calendario'), prazo.texto);

    item.append(info, etiqueta);
    lista.appendChild(item);
  });

  document.getElementById('vazio_prazos').hidden = proximas.length > 0;
}

/* ----- RECURSOS DE ESTUDO ----- */

const dialogoRecurso = document.getElementById('dialogo_recurso');
const formRecurso = document.getElementById('form_recurso');

function guardar_recursos() {
  return guardar_dados(CHAVE_RECURSOS, recursos);
}

function validar_recurso(dados) {
  const erros = {};

  if (dados.titulo.length < 3) {
    erros.recurso_titulo = 'Escreve um título com pelo menos 3 caracteres.';
  }

  if (dados.disciplina.length < 2) {
    erros.recurso_disciplina = 'Indica a disciplina.';
  }

  if (!dados.url) {
    erros.recurso_url = 'Cola o endereço do recurso.';
  } else if (!url_valido(dados.url)) {
    erros.recurso_url = 'Endereço inválido. Começa por http:// ou https://.';
  }

  return erros;
}

formRecurso.addEventListener('submit', function (evento) {
  evento.preventDefault();

  const dados = {
    titulo: document.getElementById('recurso_titulo').value.trim(),
    disciplina: document.getElementById('recurso_disciplina').value.trim(),
    descricao: document.getElementById('recurso_descricao').value.trim(),
    url: document.getElementById('recurso_url').value.trim()
  };

  if (!mostrar_erros(formRecurso, validar_recurso(dados))) return;

  dados.disciplina = normalizar_disciplina(dados.disciplina);
  recursos.push(Object.assign({ id: gerar_id() }, dados));

  guardar_recursos();
  dialogoRecurso.close();
  atualizar_tudo();
  mostrar_aviso('Recurso guardado.');
});

document.getElementById('botao_novo_recurso').addEventListener('click', function () {
  limpar_erros(formRecurso);
  formRecurso.reset();
  dialogoRecurso.showModal();
  document.getElementById('recurso_titulo').focus();
});

function criar_cartao_recurso(r) {
  const cartao = criar('article', 'cartao cartao_recurso');
  cartao.appendChild(criar('h4', '', r.titulo));
  if (r.descricao) cartao.appendChild(criar('p', 'texto_suave', r.descricao));

  const acoes = criar('div', 'recurso_acoes');

  const ligacao = criar('a', 'botao botao_secundario');
  ligacao.href = r.url;
  ligacao.target = '_blank';
  ligacao.rel = 'noopener noreferrer';
  ligacao.append(criar_icone('link'), 'Abrir recurso');

  acoes.append(ligacao, criar_botao_icone('eliminar', 'Eliminar recurso', 'eliminar', r.id, true));
  cartao.appendChild(acoes);
  return cartao;
}

function render_recursos() {
  const lista = document.getElementById('lista_recursos');
  lista.replaceChildren();
  document.getElementById('vazio_recursos').hidden = recursos.length > 0;

  const grupos = new Map();
  recursos.forEach(function (r) {
    if (!grupos.has(r.disciplina)) grupos.set(r.disciplina, []);
    grupos.get(r.disciplina).push(r);
  });

  Array.from(grupos.keys())
    .sort(function (a, b) { return a.localeCompare(b, 'pt'); })
    .forEach(function (disciplina) {
      const grupo = criar('div', 'grupo_recursos');
      grupo.appendChild(criar('h3', '', disciplina));

      const grelha = criar('div', 'grelha_cartoes');
      grupos.get(disciplina).forEach(function (r) {
        grelha.appendChild(criar_cartao_recurso(r));
      });

      grupo.appendChild(grelha);
      lista.appendChild(grupo);
    });
}

document.getElementById('lista_recursos').addEventListener('click', function (evento) {
  const botao = evento.target.closest('button[data-acao="eliminar"]');
  if (!botao) return;

  const recurso = recursos.find(function (r) { return r.id === botao.dataset.id; });
  if (!recurso) return;
  if (!confirm('Eliminar o recurso "' + recurso.titulo + '"?')) return;

  recursos = recursos.filter(function (r) { return r.id !== recurso.id; });
  guardar_recursos();
  atualizar_tudo();
  mostrar_aviso('Recurso eliminado.');
});

/* ----- PERFIL ----- */

const formPerfil = document.getElementById('form_perfil');

function render_perfil() {
  document.getElementById('perfil_nome').value = perfil.nome;
  document.getElementById('perfil_curso').value = perfil.curso;
  document.getElementById('perfil_instituicao').value = perfil.instituicao;
}

formPerfil.addEventListener('submit', function (evento) {
  evento.preventDefault();

  perfil = {
    nome: document.getElementById('perfil_nome').value.trim(),
    curso: document.getElementById('perfil_curso').value.trim(),
    instituicao: document.getElementById('perfil_instituicao').value.trim()
  };

  if (guardar_dados(CHAVE_PERFIL, perfil)) mostrar_aviso('Perfil guardado.');
  render_inicio();
});

/* ----- DEFINIÇÕES ----- */

document.getElementById('botao_apagar_dados').addEventListener('click', function () {
  if (!confirm('Apagar todas as tarefas, recursos e dados do perfil? Esta ação não pode ser desfeita.')) return;

  try {
    localStorage.removeItem(CHAVE_TAREFAS);
    localStorage.removeItem(CHAVE_RECURSOS);
    localStorage.removeItem(CHAVE_PERFIL);
  } catch (erro) {
    mostrar_aviso('Não foi possível apagar os dados.', true);
    return;
  }

  tarefas = [];
  recursos = [];
  perfil = { nome: '', curso: '', instituicao: '' };
  render_perfil();
  atualizar_tudo();
  mostrar_aviso('Dados apagados.');
});

/* ----- ATUALIZAÇÃO GERAL ----- */

// Chamada sempre que os dados mudam: mantém tudo sincronizado
function atualizar_tudo() {
  atualizar_lista_disciplinas();
  render_tarefas();
  render_inicio();
  render_estatisticas();
  render_recursos();
}

/* ----- ARRANQUE ----- */

// Ao carregar a página, abre a secção indicada no endereço (se existir)
function iniciar() {
  const id = location.hash.slice(1);
  const existe = Array.from(secoes).some(function (s) { return s.id === id; });
  mostrar_secao(existe ? id : 'inicio');

  render_perfil();
  atualizar_tudo();
}

iniciar();
