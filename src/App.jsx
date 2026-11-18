
import { useEffect, useState } from "react";
import "./App.css";

import Clientes from "./Clientes";
import Orcamentos from "./Orcamentos";
import ListaOrcamentos from "./ListaOrcamentos";
import Administracao from "./Administracao";

import {
  LayoutDashboard,
  FileText,
  Users,
  Receipt,
  Settings,
  Plus,
  Bell,
  Search,
  TrendingUp,
  Clock,
  CheckCircle2,
  Wallet,
  Menu,
  Eye,
  ArrowLeft,
  Download,
  Pencil,
  Check,
  X,
  Building2,
  Save,
} from "lucide-react";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ========================================
// API E FUNÇÕES AUXILIARES
// ========================================

const API_URL = "http://localhost:3000/api";

async function requisicaoAPI(url, opcoes = {}) {
  const resposta = await fetch(`${API_URL}${url}`, {
    ...opcoes,
    credentials: "include",
    headers: {
      ...(opcoes.body ? { "Content-Type": "application/json" } : {}),
      ...opcoes.headers,
    },
  });

  const texto = await resposta.text();
  let dados = {};

  try {
    dados = texto ? JSON.parse(texto) : {};
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }

  if (!resposta.ok) {
    const erro = new Error(
      dados.mensagem || "Não foi possível realizar a operação."
    );

    erro.status = resposta.status;
    erro.dados = dados;

    throw erro;
  }

  return dados;
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(data) {
  if (!data) return "Não informada";

  const partes = String(data).slice(0, 10).split("-");

  if (partes.length !== 3) return data;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function obterServico(item) {
  if (item.servico) return item.servico;

  if (!item.itens || item.itens.length === 0) {
    return "Não informado";
  }

  const primeiroServico = item.itens[0].descricao;

  if (item.itens.length === 1) {
    return primeiroServico;
  }

  return `${primeiroServico} + ${item.itens.length - 1} item(ns)`;
}

function converterConfiguracoesBanco(dados = {}) {
  return {
    nomeEmpresa: dados.nome_empresa || "",
    documento: dados.documento || "",
    telefone: dados.telefone || "",
    email: dados.email || "",
    endereco: dados.endereco || "",
    validade: String(dados.validade_padrao_dias || 7),
    pagamento: dados.condicoes_pagamento || "",
    observacoes: dados.observacoes_padrao || "",
  };
}

function montarDadosOrcamento(orcamento, status) {
  return {
    clienteId: Number(orcamento.clienteId),
    dataEmissao: String(orcamento.dataEmissao || "").slice(0, 10),
    validade: Number(orcamento.validade || 7),
    desconto: Number(orcamento.desconto || 0),
    total: Number(orcamento.total || 0),
    status: status || orcamento.status || "Pendente",
    observacoes: orcamento.observacoes || "",
    formaPagamento: orcamento.formaPagamento || "",
    itens: (orcamento.itens || []).map((item) => ({
      descricao: item.descricao,
      quantidade: Number(item.quantidade),
      valor: Number(item.valor || 0),
    })),
  };
}

// ========================================
// COMPONENTE PRINCIPAL
// ========================================

function App() {
  const [paginaAtual, setPaginaAtual] = useState(() => {
    const hash = window.location.hash;

    if (hash === "#recibos") return "recibos";
    if (hash === "#configuracoes") return "configuracoes";
    if (hash === "#clientes") return "clientes";
    if (hash === "#orcamentos") return "lista-orcamentos";
    if (hash === "#usuarios") return "usuarios";

    return "dashboard";
  });

  const [orcamentoSelecionado, setOrcamentoSelecionado] = useState(null);
  const [orcamentoEdicao, setOrcamentoEdicao] = useState(null);

  const [orcamentosSalvos, setOrcamentosSalvos] = useState([]);
  const [configuracoes, setConfiguracoes] = useState({});
  const [pesquisa, setPesquisa] = useState("");

  const [usuario, setUsuario] = useState(null);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [assinaturaBloqueada, setAssinaturaBloqueada] = useState(false);

  const ehAdmin = usuario?.perfil === "admin";

  // ========================================
  // VERIFICAR SESSÃO
  // ========================================

  useEffect(() => {
    async function verificarLogin() {
      try {
        const dados = await requisicaoAPI("/me");

        if (dados.autenticado && dados.usuario) {
          setUsuario(dados.usuario);
        } else {
          setUsuario(null);
        }
      } catch (erro) {
        console.error("Erro ao verificar sessão:", erro);
        setUsuario(null);
      } finally {
        setVerificandoSessao(false);
      }
    }

    verificarLogin();
  }, []);

  // ========================================
  // SEPARAR ACESSO ADMINISTRADOR E CLIENTE
  // ========================================

  useEffect(() => {
    if (!usuario) return;

    if (usuario.perfil === "admin") {
      setPaginaAtual("usuarios");
      window.location.hash = "#usuarios";

      setOrcamentosSalvos([]);
      setConfiguracoes({});
      setOrcamentoSelecionado(null);
      setOrcamentoEdicao(null);
      setPesquisa("");
      return;
    }

    // Cliente não pode acessar a área administrativa.
    if (paginaAtual === "usuarios") {
      setPaginaAtual("dashboard");
      window.location.hash = "#dashboard";
    }
  }, [usuario, paginaAtual]);

  // ========================================
  // CARREGAR DADOS DO CLIENTE NO MYSQL
  // ========================================

  useEffect(() => {
    if (!usuario || usuario.perfil === "admin" || assinaturaBloqueada) {
      setOrcamentosSalvos([]);
      setConfiguracoes({});
      setCarregandoDados(false);
      return;
    }

    let ativo = true;

    async function carregarDados() {
      setCarregandoDados(true);

      try {
        const [orcamentos, respostaConfiguracoes] = await Promise.all([
          requisicaoAPI("/orcamentos"),
          requisicaoAPI("/configuracoes"),
        ]);

        if (!ativo) return;

        setOrcamentosSalvos(
          Array.isArray(orcamentos) ? orcamentos : []
        );

        setConfiguracoes(
          converterConfiguracoesBanco(
            respostaConfiguracoes.configuracoes || {}
          )
        );
      } catch (erro) {
        console.error("Erro ao carregar dados:", erro);

        if (ativo) {
          if (
            erro.status === 403 &&
            erro.dados?.assinatura_bloqueada
          ) {
            setAssinaturaBloqueada(true);

            setUsuario((anterior) => {
              const statusAssinatura =
                erro.dados.status_assinatura ||
                anterior.status_assinatura;

              if (statusAssinatura === anterior.status_assinatura) {
                return anterior;
              }

              return {
                ...anterior,
                status_assinatura: statusAssinatura,
              };
            });

            return;
          }

          alert(
            erro.message ||
              "Não foi possível carregar os dados do sistema."
          );
        }
      } finally {
        if (ativo) setCarregandoDados(false);
      }
    }

    carregarDados();

    return () => {
      ativo = false;
    };
  }, [usuario, assinaturaBloqueada]);

  async function recarregarOrcamentos() {
    if (ehAdmin) return [];

    const dados = await requisicaoAPI("/orcamentos");
    const lista = Array.isArray(dados) ? dados : [];

    setOrcamentosSalvos(lista);

    return lista;
  }

  // ========================================
  // LOGIN
  // ========================================

  async function realizarLogin(email, senha) {
    await requisicaoAPI("/login", {
      method: "POST",
      body: JSON.stringify({ email, senha }),
    });

    // Busca os dados completos do usuário, incluindo o plano.
    const sessao = await requisicaoAPI("/me");

    if (!sessao.autenticado || !sessao.usuario) {
      throw new Error("Não foi possível carregar os dados da sua conta.");
    }

    const usuarioLogado = sessao.usuario;

    setUsuario(usuarioLogado);
    setAssinaturaBloqueada(false);

    if (usuarioLogado.perfil === "admin") {
      setPaginaAtual("usuarios");
      window.location.hash = "#usuarios";
    } else {
      setPaginaAtual("dashboard");
      window.location.hash = "#dashboard";
    }
  }

  // ========================================
  // LOGOUT
  // ========================================

  async function realizarLogout() {
    try {
      await requisicaoAPI("/logout", {
        method: "POST",
      });
    } catch (erro) {
      console.error("Erro ao sair:", erro);
    } finally {
      setUsuario(null);
      setAssinaturaBloqueada(false);
      setPaginaAtual("dashboard");
      setOrcamentoSelecionado(null);
      setOrcamentoEdicao(null);
      setOrcamentosSalvos([]);
      setConfiguracoes({});
      setPesquisa("");

      window.location.hash = "#dashboard";
    }
  }

  // ========================================
  // SALVAR CONFIGURAÇÕES NO MYSQL
  // ========================================

  async function salvarConfiguracoes(novasConfiguracoes) {
    try {
      await requisicaoAPI("/configuracoes", {
        method: "PUT",
        body: JSON.stringify({
          nome_empresa: novasConfiguracoes.nomeEmpresa || "",
          documento: novasConfiguracoes.documento || "",
          telefone: novasConfiguracoes.telefone || "",
          email: novasConfiguracoes.email || "",
          endereco: novasConfiguracoes.endereco || "",
          validade_padrao_dias: Number(
            novasConfiguracoes.validade || 7
          ),
          condicoes_pagamento: novasConfiguracoes.pagamento || "",
          observacoes_padrao: novasConfiguracoes.observacoes || "",
        }),
      });

      setConfiguracoes(novasConfiguracoes);

      return true;
    } catch (erro) {
      console.error("Erro ao salvar configurações:", erro);
      alert(erro.message || "Não foi possível salvar as configurações.");
      throw erro;
    }
  }

  // ========================================
  // NAVEGAÇÃO
  // ========================================

  function abrirPagina(pagina) {
    // Administrador só pode acessar a administração.
    if (ehAdmin && pagina !== "usuarios") {
      setPaginaAtual("usuarios");
      window.location.hash = "#usuarios";
      return;
    }

    // Cliente não pode acessar a administração.
    if (!ehAdmin && pagina === "usuarios") {
      setPaginaAtual("dashboard");
      window.location.hash = "#dashboard";
      return;
    }

    setPaginaAtual(pagina);

    const rotas = {
      dashboard: "#dashboard",
      "lista-orcamentos": "#orcamentos",
      orcamentos: "#orcamentos",
      "detalhes-orcamento": "#orcamentos",
      clientes: "#clientes",
      recibos: "#recibos",
      configuracoes: "#configuracoes",
      usuarios: "#usuarios",
    };

    if (rotas[pagina]) {
      window.location.hash = rotas[pagina];
    }
  }

  function abrirOrcamento(orcamento) {
    setOrcamentoSelecionado(orcamento);
    abrirPagina("detalhes-orcamento");
  }

  function voltarDashboard() {
    setOrcamentoSelecionado(null);
    setOrcamentoEdicao(null);
    abrirPagina("dashboard");
  }

  // ========================================
  // EDITAR ORÇAMENTO
  // ========================================

  function editarOrcamento(orcamento) {
    setOrcamentoSelecionado(orcamento);
    setOrcamentoEdicao(orcamento);
    abrirPagina("orcamentos");
  }

  // ========================================
  // SALVAR ORÇAMENTO NO MYSQL
  // ========================================

  async function salvarOrcamento(orcamento) {
    try {
      const estaEditando = Boolean(orcamentoEdicao?.id);
      const dadosOrcamento = montarDadosOrcamento(orcamento);

      if (!dadosOrcamento.clienteId) {
        alert("Selecione um cliente válido para o orçamento.");
        return;
      }

      if (!dadosOrcamento.dataEmissao) {
        alert("Informe a data de emissão do orçamento.");
        return;
      }

      if (!dadosOrcamento.itens.length) {
        alert("Adicione pelo menos um item ao orçamento.");
        return;
      }

      let resposta;

      if (estaEditando) {
        resposta = await requisicaoAPI(
          `/orcamentos/${orcamentoEdicao.id}`,
          {
            method: "PUT",
            body: JSON.stringify(dadosOrcamento),
          }
        );
      } else {
        resposta = await requisicaoAPI("/orcamentos", {
          method: "POST",
          body: JSON.stringify(dadosOrcamento),
        });
      }

      const listaAtualizada = await recarregarOrcamentos();

      const idSalvo = estaEditando
        ? orcamentoEdicao.id
        : resposta.id;

      const atualizado = listaAtualizada.find(
        (item) => String(item.id) === String(idSalvo)
      );

      setOrcamentoSelecionado(atualizado || null);
      setOrcamentoEdicao(null);
      abrirPagina("detalhes-orcamento");
    } catch (erro) {
      console.error("Erro ao salvar orçamento:", erro);
      alert(erro.message || "Não foi possível salvar o orçamento.");
    }
  }

  // ========================================
  // ALTERAR STATUS DO ORÇAMENTO
  // ========================================

  async function alterarStatus(orcamento, novoStatus) {
    try {
      const dadosOrcamento = montarDadosOrcamento(
        orcamento,
        novoStatus
      );

      await requisicaoAPI(`/orcamentos/${orcamento.id}`, {
        method: "PUT",
        body: JSON.stringify(dadosOrcamento),
      });

      const listaAtualizada = await recarregarOrcamentos();

      const atualizado = listaAtualizada.find(
        (item) => String(item.id) === String(orcamento.id)
      );

      setOrcamentoSelecionado(atualizado || null);
    } catch (erro) {
      console.error("Erro ao alterar status:", erro);
      alert(erro.message || "Não foi possível alterar o status.");
    }
  }

  // ========================================
  // REGISTRAR RECEBIMENTO
  // ========================================

  async function registrarRecebimento(orcamento) {
    const valorFinal = Number(orcamento.total || 0);

    if (valorFinal <= 0) {
      alert(
        "Este orçamento não possui um valor válido para recebimento."
      );
      return;
    }

    if (
      (orcamento.statusRecebimento || "")
        .trim()
        .toLowerCase() === "recebido"
    ) {
      alert("Este orçamento já possui um recebimento registrado.");
      return;
    }

    const confirmar = window.confirm(
      `Confirma o recebimento de ${moeda(valorFinal)} do orçamento ${orcamento.numero}?`
    );

    if (!confirmar) return;

    try {
      await requisicaoAPI(
        `/orcamentos/${orcamento.id}/recebimento`,
        {
          method: "PUT",
          body: JSON.stringify({
            valorRecebido: valorFinal,
          }),
        }
      );

      const listaAtualizada = await recarregarOrcamentos();

      const atualizado = listaAtualizada.find(
        (item) => String(item.id) === String(orcamento.id)
      );

      if (orcamentoSelecionado?.id === orcamento.id) {
        setOrcamentoSelecionado(atualizado || null);
      }

      alert(
        `Recebimento registrado com sucesso!\n\nValor recebido: ${moeda(valorFinal)}`
      );
    } catch (erro) {
      console.error("Erro ao registrar recebimento:", erro);
      alert(erro.message || "Não foi possível registrar o recebimento.");
    }
  }

  // ========================================
  // EXCLUIR ORÇAMENTO
  // ========================================

  async function excluirOrcamento(orcamento) {
    const confirmar = window.confirm(
      `Deseja realmente excluir o orçamento ${orcamento.numero}? Esta ação não poderá ser desfeita.`
    );

    if (!confirmar) return;

    try {
      await requisicaoAPI(`/orcamentos/${orcamento.id}`, {
        method: "DELETE",
      });

      await recarregarOrcamentos();

      setOrcamentoSelecionado(null);
      setOrcamentoEdicao(null);
      abrirPagina("lista-orcamentos");
    } catch (erro) {
      console.error("Erro ao excluir orçamento:", erro);
      alert(erro.message || "Não foi possível excluir o orçamento.");
    }
  }

  // ========================================
  // DADOS DO DASHBOARD
  // ========================================

  const orcamentosOrdenados = [...orcamentosSalvos].sort(
    (a, b) => {
      const numeroA = Number(
        String(a.numero || "").replace(/\D/g, "")
      );

      const numeroB = Number(
        String(b.numero || "").replace(/\D/g, "")
      );

      return numeroA - numeroB;
    }
  );

  const orcamentosRecentes = [...orcamentosOrdenados]
    .slice(-5)
    .reverse();

  // ========================================
  // PESQUISA
  // ========================================

  const termoPesquisa = pesquisa.trim().toLowerCase();

  const resultadosPesquisa = termoPesquisa
    ? [...orcamentosSalvos]
        .filter((item) => {
          const cliente = String(item.cliente || "").toLowerCase();
          const numero = String(item.numero || "").toLowerCase();
          const servico = String(obterServico(item) || "").toLowerCase();

          return (
            cliente.includes(termoPesquisa) ||
            numero.includes(termoPesquisa) ||
            servico.includes(termoPesquisa)
          );
        })
        .sort((a, b) => {
          const numeroA = Number(
            String(a.numero || "").replace(/\D/g, "")
          );

          const numeroB = Number(
            String(b.numero || "").replace(/\D/g, "")
          );

          return numeroB - numeroA;
        })
    : orcamentosRecentes;

  const pendentes = orcamentosSalvos.filter(
    (item) =>
      (item.status || "Pendente").toLowerCase() === "pendente"
  ).length;

  const aprovados = orcamentosSalvos.filter(
    (item) =>
      (item.status || "Pendente").toLowerCase() === "aprovado"
  ).length;

  const valorTotal = orcamentosSalvos.reduce(
    (total, item) => total + Number(item.total || 0),
    0
  );

  // ========================================
  // PROTEÇÃO DE ACESSO
  // ========================================

  if (verificandoSessao) {
    return (
      <div className="login-loading">
        Verificando acesso ao OrçaFácil...
      </div>
    );
  }

  if (!usuario) {
    return <Login aoEntrar={realizarLogin} />;
  }

  if (assinaturaBloqueada && !ehAdmin) {
    const assinaturaVencida =
      usuario.status_assinatura === "vencida";

    return (
      <div className="assinatura-bloqueada-page">
        <div className="assinatura-bloqueada-card">
          <div className="assinatura-bloqueada-icone">
            <FileText size={32} />
          </div>

          <span className="assinatura-bloqueada-marca">
            OrçaFácil
          </span>

          <h1>
            {assinaturaVencida
              ? "Sua assinatura venceu"
              : "Acesso temporariamente bloqueado"}
          </h1>

          <p className="assinatura-bloqueada-descricao">
            {assinaturaVencida
              ? "Para continuar utilizando o OrçaFácil, é necessário renovar sua assinatura."
              : "Sua assinatura não está ativa. Entre em contato com o administrador para regularizar seu acesso."}
          </p>

          <div className="assinatura-bloqueada-dados">
            <div className="assinatura-bloqueada-linha">
              <span>Cliente</span>
              <strong>{usuario.nome}</strong>
            </div>

            <div className="assinatura-bloqueada-linha">
              <span>Plano</span>
              <strong>{usuario.plano || "Não informado"}</strong>
            </div>

            <div className="assinatura-bloqueada-linha">
              <span>Situação</span>
              <strong
                className={`assinatura-status ${
                  assinaturaVencida ? "vencida" : "bloqueada"
                }`}
              >
                {usuario.status_assinatura || "Não informada"}
              </strong>
            </div>

            <div className="assinatura-bloqueada-linha">
              <span>Vencimento</span>
              <strong>
                {formatarData(usuario.proxima_cobranca_em)}
              </strong>
            </div>
          </div>

          <div className="assinatura-bloqueada-aviso">
            <strong>Precisa de ajuda?</strong>
            <p>
              Entre em contato com o administrador do OrçaFácil
              para solicitar a renovação da sua assinatura.
            </p>
          </div>

          <button
            type="button"
            className="assinatura-bloqueada-sair"
            onClick={realizarLogout}
          >
            Sair da conta
          </button>

          <span className="assinatura-bloqueada-rodape">
            OrçaFácil · Gestão inteligente para sua empresa
          </span>
        </div>
      </div>
    );
  }

  // ========================================
  // TELA PRINCIPAL
  // ========================================

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <FileText size={24} />
          </div>

          <div>
            <h2>OrçaFácil</h2>
            <span>Gestão inteligente</span>
          </div>
        </div>

        <div className="menu-label">
          {ehAdmin ? "ADMINISTRAÇÃO" : "MENU PRINCIPAL"}
        </div>

        <nav className="menu">
          {ehAdmin ? (
            <a
              className={`menu-item ${
                paginaAtual === "usuarios" ? "active" : ""
              }`}
              href="#usuarios"
              onClick={(e) => {
                e.preventDefault();
                abrirPagina("usuarios");
              }}
            >
              <Users size={19} />
              Usuários
            </a>
          ) : (
            <>
              <a
                className={`menu-item ${
                  paginaAtual === "dashboard" ? "active" : ""
                }`}
                href="#dashboard"
                onClick={(e) => {
                  e.preventDefault();
                  voltarDashboard();
                }}
              >
                <LayoutDashboard size={19} />
                Dashboard
              </a>

              <a
                className={`menu-item ${
                  [
                    "lista-orcamentos",
                    "orcamentos",
                    "detalhes-orcamento",
                  ].includes(paginaAtual)
                    ? "active"
                    : ""
                }`}
                href="#orcamentos"
                onClick={(e) => {
                  e.preventDefault();
                  setOrcamentoEdicao(null);
                  abrirPagina("lista-orcamentos");
                }}
              >
                <FileText size={19} />
                Orçamentos
              </a>

              <a
                className={`menu-item ${
                  paginaAtual === "clientes" ? "active" : ""
                }`}
                href="#clientes"
                onClick={(e) => {
                  e.preventDefault();
                  abrirPagina("clientes");
                }}
              >
                <Users size={19} />
                Clientes
              </a>

              <a
                className={`menu-item ${
                  paginaAtual === "recibos" ? "active" : ""
                }`}
                href="#recibos"
                onClick={(e) => {
                  e.preventDefault();
                  abrirPagina("recibos");
                }}
              >
                <Receipt size={19} />
                Recebimentos
              </a>
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          {!ehAdmin && (
            <a
              className={`menu-item ${
                paginaAtual === "configuracoes" ? "active" : ""
              }`}
              href="#configuracoes"
              onClick={(e) => {
                e.preventDefault();
                abrirPagina("configuracoes");
              }}
            >
              <Settings size={19} />
              Configurações
            </a>
          )}

          <div className="profile">
            <div className="avatar">OF</div>

            <div className="profile-info">
              <strong>{usuario?.nome || "Usuário"}</strong>
              <span>{ehAdmin ? "Administrador" : "Cliente"}</span>
            </div>

            <button
              type="button"
              className="logout-button"
              onClick={realizarLogout}
              title="Sair da conta"
            >
              Sair
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="mobile-brand">
            <Menu size={23} />
            <strong>OrçaFácil</strong>
          </div>

          {!ehAdmin && (
            <>
              <div className="search-box">
                <Search size={18} />

                <input
                  type="search"
                  placeholder="Pesquisar cliente, orçamento ou serviço..."
                  value={pesquisa}
                  onChange={(e) => setPesquisa(e.target.value)}
                />

                {pesquisa && (
                  <button
                    type="button"
                    className="search-clear"
                    onClick={() => setPesquisa("")}
                    aria-label="Limpar pesquisa"
                    title="Limpar pesquisa"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <button
                type="button"
                className="notification"
                aria-label="Notificações"
              >
                <Bell size={20} />
              </button>
            </>
          )}
        </header>

        <section className="content">
          {ehAdmin ? (
            <Administracao />
          ) : carregandoDados ? (
            <div className="orcamentos-vazio">
              <span>Carregando seus dados...</span>
            </div>
          ) : paginaAtual === "configuracoes" ? (
            <Configuracoes
              configuracoes={configuracoes}
              usuario={usuario}
              aoSalvar={salvarConfiguracoes}
            />
          ) : paginaAtual === "lista-orcamentos" ? (
            <ListaOrcamentos
              orcamentos={orcamentosSalvos}
              aoNovo={() => {
                setOrcamentoEdicao(null);
                abrirPagina("orcamentos");
              }}
              aoAbrir={abrirOrcamento}
              aoEditar={editarOrcamento}
              aoExcluir={excluirOrcamento}
              aoVoltar={voltarDashboard}
            />
          ) : paginaAtual === "orcamentos" ? (
            <Orcamentos
              key={orcamentoEdicao?.id || "novo"}
              orcamentoEdicao={orcamentoEdicao}
              aoSalvar={salvarOrcamento}
              aoVoltar={() => {
                if (orcamentoEdicao) {
                  setOrcamentoEdicao(null);
                  abrirPagina("detalhes-orcamento");
                } else {
                  abrirPagina("lista-orcamentos");
                }
              }}
            />
          ) : paginaAtual === "clientes" ? (
            <Clientes />
          ) : paginaAtual === "recibos" ? (
            <Recebimentos
              orcamentos={orcamentosSalvos}
              aoAbrir={abrirOrcamento}
              aoRegistrarRecebimento={registrarRecebimento}
            />
          ) : paginaAtual === "detalhes-orcamento" &&
            orcamentoSelecionado ? (
            <DetalhesOrcamento
              orcamento={orcamentoSelecionado}
              aoVoltar={() => {
                setOrcamentoSelecionado(null);
                abrirPagina("lista-orcamentos");
              }}
              aoEditar={() => editarOrcamento(orcamentoSelecionado)}
              aoAlterarStatus={(status) =>
                alterarStatus(orcamentoSelecionado, status)
              }
            />
          ) : (
            <>
              <div className="welcome">
                <div>
                  <span className="date-label">PAINEL DE CONTROLE</span>
                  <h1>Visão geral</h1>
                  <p>Bem-vindo ao seu painel de gestão.</p>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setOrcamentoEdicao(null);
                    abrirPagina("orcamentos");
                  }}
                >
                  <Plus size={19} />
                  Novo orçamento
                </button>
              </div>

              <div className="stats">
                <StatCard
                  icon={<FileText />}
                  title="Total de orçamentos"
                  value={orcamentosSalvos.length}
                  detail="Documentos criados"
                  color="green"
                />

                <StatCard
                  icon={<Clock />}
                  title="Pendentes"
                  value={String(pendentes).padStart(2, "0")}
                  detail="Aguardando aprovação"
                  color="yellow"
                />

                <StatCard
                  icon={<CheckCircle2 />}
                  title="Aprovados"
                  value={String(aprovados).padStart(2, "0")}
                  detail="Orçamentos aprovados"
                  color="blue"
                />

                <StatCard
                  icon={<Wallet />}
                  title="Total em orçamentos"
                  value={moeda(valorTotal)}
                  detail="Soma dos documentos"
                  color="purple"
                />
              </div>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>
                      {termoPesquisa
                        ? "Resultados da pesquisa"
                        : "Orçamentos recentes"}
                    </h2>

                    <p>
                      {termoPesquisa
                        ? `${resultadosPesquisa.length} orçamento(s) encontrado(s).`
                        : "Acompanhe seus últimos documentos."}
                    </p>
                  </div>

                  {!termoPesquisa && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => abrirPagina("lista-orcamentos")}
                    >
                      Ver todos
                    </button>
                  )}
                </div>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>NÚMERO</th>
                        <th>CLIENTE</th>
                        <th>SERVIÇO</th>
                        <th>VALOR</th>
                        <th>STATUS</th>
                        <th>AÇÃO</th>
                      </tr>
                    </thead>

                    <tbody>
                      {resultadosPesquisa.length > 0 ? (
                        resultadosPesquisa.map((item) => (
                          <tr key={item.id}>
                            <td>{item.numero}</td>
                            <td>{item.cliente || "Não informado"}</td>
                            <td>{obterServico(item)}</td>
                            <td className="value">{moeda(item.total)}</td>
                            <td>
                              <span
                                className={`status ${(item.status || "Pendente").toLowerCase()}`}
                              >
                                {item.status || "Pendente"}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => abrirOrcamento(item)}
                              >
                                <Eye size={16} />
                                Abrir
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6">
                            <div className="orcamentos-vazio">
                              <Search size={30} />
                              <strong>
                                {termoPesquisa
                                  ? "Nenhum resultado encontrado"
                                  : "Nenhum orçamento cadastrado"}
                              </strong>
                              <span>
                                {termoPesquisa
                                  ? "Verifique o nome do cliente ou tente outro termo."
                                  : "Clique em Novo orçamento para começar."}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="bottom-card">
                <div className="bottom-icon">
                  <TrendingUp size={25} />
                </div>

                <div>
                  <h3>Organize seus serviços com facilidade!</h3>
                  <p>
                    Crie orçamentos profissionais e mantenha seus clientes
                    sempre organizados.
                  </p>
                </div>
              </section>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

// ========================================
// TELA DE LOGIN
// ========================================

function Login({ aoEntrar }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviarLogin(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      await aoEntrar(email.trim(), senha);
    } catch (erro) {
      setErro(erro.message || "E-mail ou senha incorretos.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand-icon">
          <FileText size={30} />
        </div>

        <h1>OrçaFácil</h1>

        <p className="login-subtitle">
          Gestão inteligente para sua empresa
        </p>

        <form onSubmit={enviarLogin}>
          <div className="login-field">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Digite seu e-mail"
              autoComplete="username"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-senha">Senha</label>
            <input
              id="login-senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              required
            />
          </div>

          {erro && <div className="login-error">{erro}</div>}

          <button
            type="submit"
            className="login-button"
            disabled={carregando}
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <span className="login-footer">
          Acesso restrito • OrçaFácil
        </span>
      </div>
    </div>
  );
}

// ========================================
// TELA DE CONFIGURAÇÕES
// ========================================

function Configuracoes({ configuracoes, usuario, aoSalvar }) {
  const [formulario, setFormulario] = useState({
    nomeEmpresa: "",
    documento: "",
    telefone: "",
    email: "",
    endereco: "",
    validade: "7",
    pagamento: "",
    observacoes: "",
  });

  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setFormulario({
      nomeEmpresa: configuracoes.nomeEmpresa || "",
      documento: configuracoes.documento || "",
      telefone: configuracoes.telefone || "",
      email: configuracoes.email || "",
      endereco: configuracoes.endereco || "",
      validade: configuracoes.validade || "7",
      pagamento: configuracoes.pagamento || "",
      observacoes: configuracoes.observacoes || "",
    });
  }, [configuracoes]);

  function atualizarCampo(campo, valor) {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));

    setSalvo(false);
  }

  async function salvarFormulario(e) {
    e.preventDefault();
    setSalvando(true);
    setSalvo(false);

    try {
      await aoSalvar(formulario);
      setSalvo(true);
    } catch {
      // A mensagem de erro é apresentada pela função do App.
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="orcamentos-page">
      <div className="orcamentos-header">
        <div>
          <span className="clientes-label">
            PERSONALIZAÇÃO DO SISTEMA
          </span>
          <h1>Configurações</h1>
          <p>
            Gerencie os dados da sua empresa e personalize seus documentos.
          </p>
        </div>
      </div>

      <form onSubmit={salvarFormulario}>
        <section className="orcamento-panel">
          <h2>
            <Building2 size={20} />
            Dados da empresa
          </h2>

          <p>Cadastre as informações que identificam sua empresa.</p>

          <div className="orcamento-grid" style={{ marginTop: 20 }}>
            <div>
              <label>Nome da empresa</label>
              <input
                type="text"
                value={formulario.nomeEmpresa}
                onChange={(e) =>
                  atualizarCampo("nomeEmpresa", e.target.value)
                }
                placeholder="Ex.: Minha Empresa"
              />
            </div>

            <div>
              <label>CNPJ ou CPF</label>
              <input
                type="text"
                value={formulario.documento}
                onChange={(e) =>
                  atualizarCampo("documento", e.target.value)
                }
                placeholder="Digite seu documento"
              />
            </div>

            <div>
              <label>Telefone / WhatsApp</label>
              <input
                type="text"
                value={formulario.telefone}
                onChange={(e) =>
                  atualizarCampo("telefone", e.target.value)
                }
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <label>E-mail</label>
              <input
                type="email"
                value={formulario.email}
                onChange={(e) =>
                  atualizarCampo("email", e.target.value)
                }
                placeholder="empresa@email.com"
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label>Endereço completo</label>
              <input
                type="text"
                value={formulario.endereco}
                onChange={(e) =>
                  atualizarCampo("endereco", e.target.value)
                }
                placeholder="Rua, número, bairro, cidade e estado"
              />
            </div>
          </div>
        </section>

        <section className="orcamento-panel">
          <h2>
            <FileText size={20} />
            Padrões dos orçamentos
          </h2>

          <p>
            Defina informações que poderão ser usadas nos próximos documentos.
          </p>

          <div className="orcamento-grid" style={{ marginTop: 20 }}>
            <div>
              <label>Validade padrão (dias)</label>
              <input
                type="number"
                min="1"
                value={formulario.validade}
                onChange={(e) =>
                  atualizarCampo("validade", e.target.value)
                }
                placeholder="7"
              />
            </div>

            <div>
              <label>Condições de pagamento</label>
              <input
                type="text"
                value={formulario.pagamento}
                onChange={(e) =>
                  atualizarCampo("pagamento", e.target.value)
                }
                placeholder="Ex.: À vista ou parcelado"
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label>Observações padrão</label>
              <textarea
                rows="4"
                value={formulario.observacoes}
                onChange={(e) =>
                  atualizarCampo("observacoes", e.target.value)
                }
                placeholder="Digite uma observação padrão para seus orçamentos..."
              />
            </div>
          </div>
        </section>

        <section className="orcamento-panel">
          <h2>
            <Settings size={20} />
            Informações do sistema
          </h2>

          <div className="orcamento-grid" style={{ marginTop: 20 }}>
            <div>
              <label>Nome do sistema</label>
              <strong>OrçaFácil</strong>
            </div>

            <div>
              <label>Versão</label>
              <strong>1.0.0</strong>
            </div>

            <div>
              <label>Plano atual</label>
              <strong>{usuario?.plano || "Nenhum plano cadastrado"}</strong>

              <small style={{ display: "block", marginTop: 6 }}>
                Situação:{" "}
                {usuario?.status_assinatura === "ativa"
                  ? "Ativo"
                  : usuario?.status_assinatura === "pendente"
                  ? "Pagamento pendente"
                  : usuario?.status_assinatura || "Não informado"}
              </small>
            </div>
          </div>
        </section>

        <div className="orcamento-acoes">
          <button
            type="submit"
            className="primary-button"
            disabled={salvando}
          >
            <Save size={18} />
            {salvando ? "Salvando..." : "Salvar configurações"}
          </button>

          {salvo && (
            <span
              style={{
                color: "#16a34a",
                fontWeight: 600,
              }}
            >
              <Check size={16} style={{ verticalAlign: "middle" }} />
              Configurações salvas com sucesso!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

// ========================================
// TELA DE RECEBIMENTOS
// ========================================

function Recebimentos({
  orcamentos,
  aoAbrir,
  aoRegistrarRecebimento,
}) {
  const aguardando = orcamentos.filter(
    (item) =>
      (item.status || "Pendente").trim().toLowerCase() === "aprovado" &&
      (item.statusRecebimento || "Pendente").trim().toLowerCase() !==
        "recebido"
  );

  const recebidos = orcamentos.filter(
    (item) =>
      (item.status || "Pendente").trim().toLowerCase() === "aprovado" &&
      (item.statusRecebimento || "").trim().toLowerCase() === "recebido"
  );

  const totalAReceber = aguardando.reduce(
    (total, item) => total + Number(item.total || 0),
    0
  );

  const totalRecebido = recebidos.reduce(
    (total, item) =>
      total + Number(item.valorRecebido || item.total || 0),
    0
  );

  return (
    <div className="orcamentos-page">
      <div className="orcamentos-header">
        <div>
          <span className="clientes-label">GESTÃO FINANCEIRA</span>
          <h1>Recebimentos</h1>
          <p>
            Acompanhe os valores pendentes e os recebimentos realizados.
          </p>
        </div>
      </div>

      <div className="stats">
        <StatCard
          icon={<Clock />}
          title="Aguardando recebimento"
          value={String(aguardando.length).padStart(2, "0")}
          detail="Orçamentos aprovados"
          color="yellow"
        />

        <StatCard
          icon={<Wallet />}
          title="Total a receber"
          value={moeda(totalAReceber)}
          detail="Valores com desconto aplicado"
          color="green"
        />

        <StatCard
          icon={<CheckCircle2 />}
          title="Total recebido"
          value={moeda(totalRecebido)}
          detail={`${recebidos.length} recebimento(s) realizado(s)`}
          color="blue"
        />
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Aguardando recebimento</h2>
            <p>
              {aguardando.length} orçamento(s) aguardando recebimento.
            </p>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>NÚMERO</th>
                <th>CLIENTE</th>
                <th>DATA DE EMISSÃO</th>
                <th>VALOR FINAL</th>
                <th>SITUAÇÃO</th>
                <th>AÇÃO</th>
              </tr>
            </thead>

            <tbody>
              {aguardando.length > 0 ? (
                aguardando.map((item) => (
                  <tr key={item.id}>
                    <td>{item.numero}</td>
                    <td>{item.cliente || "Não informado"}</td>
                    <td>{formatarData(item.dataEmissao)}</td>
                    <td className="value">{moeda(item.total)}</td>
                    <td>
                      <span className="status pendente">
                        Aguardando recebimento
                      </span>
                    </td>
                    <td>
                      <div className="orcamento-acoes">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => aoAbrir(item)}
                        >
                          <Eye size={16} />
                          Abrir
                        </button>

                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => aoRegistrarRecebimento(item)}
                        >
                          <Check size={16} />
                          Registrar recebimento
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">
                    <div className="orcamentos-vazio">
                      <Receipt size={30} />
                      <strong>Nenhum recebimento pendente</strong>
                      <span>
                        Quando você aprovar um orçamento, ele aparecerá aqui.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Recebimentos realizados</h2>
            <p>
              {recebidos.length} recebimento(s) registrado(s).
            </p>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>NÚMERO</th>
                <th>CLIENTE</th>
                <th>DATA DO RECEBIMENTO</th>
                <th>VALOR RECEBIDO</th>
                <th>SITUAÇÃO</th>
                <th>AÇÃO</th>
              </tr>
            </thead>

            <tbody>
              {recebidos.length > 0 ? (
                recebidos.map((item) => (
                  <tr key={item.id}>
                    <td>{item.numero}</td>
                    <td>{item.cliente || "Não informado"}</td>
                    <td>{formatarData(item.dataRecebimento)}</td>
                    <td className="value">
                      {moeda(item.valorRecebido || item.total)}
                    </td>
                    <td>
                      <span className="status aprovado">Recebido</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => aoAbrir(item)}
                      >
                        <Eye size={16} />
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">
                    <div className="orcamentos-vazio">
                      <Wallet size={30} />
                      <strong>Nenhum recebimento realizado</strong>
                      <span>
                        Os pagamentos registrados aparecerão neste histórico.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ========================================
// DETALHES DO ORÇAMENTO
// ========================================

function DetalhesOrcamento({
  orcamento,
  aoVoltar,
  aoEditar,
  aoAlterarStatus,
}) {
  const itens = orcamento.itens || [];

  function gerarPDF() {
    try {
      const doc = new jsPDF();

      const verde = [16, 185, 129];
      const escuro = [20, 28, 26];
      const cinza = [100, 110, 105];

      doc.setFillColor(...escuro);
      doc.rect(0, 0, 210, 38, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("OrçaFácil", 15, 17);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Gestão inteligente", 15, 25);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`ORÇAMENTO ${orcamento.numero}`, 195, 20, {
        align: "right",
      });

      doc.setTextColor(...cinza);
      doc.setFontSize(10);

      doc.text(
        `Data de emissão: ${formatarData(orcamento.dataEmissao)}`,
        15,
        49
      );

      doc.text(
        `Validade: ${orcamento.validade || "7"} dias`,
        15,
        56
      );

      doc.text(
        `Status: ${orcamento.status || "Pendente"}`,
        15,
        63
      );

      doc.text(
        `Forma de pagamento: ${orcamento.formaPagamento || "Não informada"}`,
        15,
        70
      );

      doc.setTextColor(...escuro);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("DADOS DO CLIENTE", 15, 84);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      doc.text(
        `Nome: ${orcamento.cliente || "Não informado"}`,
        15,
        92
      );

      doc.text(
        `Telefone: ${orcamento.telefoneCliente || "Não informado"}`,
        15,
        99
      );

      doc.text(
        `E-mail: ${orcamento.emailCliente || "Não informado"}`,
        15,
        106
      );

      const linhas = itens.map((item) => {
        const quantidade = Number(item.quantidade || 0);
        const valor = Number(item.valor || 0);

        return [
          item.descricao || "Item",
          String(quantidade),
          moeda(valor),
          moeda(quantidade * valor),
        ];
      });

      autoTable(doc, {
        startY: 117,
        head: [[
          "Descrição",
          "Quantidade",
          "Valor unitário",
          "Subtotal",
        ]],
        body: linhas,
        theme: "grid",
        headStyles: {
          fillColor: verde,
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        styles: {
          fontSize: 9,
          cellPadding: 4,
        },
      });

      let finalY = doc.lastAutoTable.finalY + 12;

      if (finalY > 245) {
        doc.addPage();
        finalY = 25;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...cinza);

      doc.text(
        `Subtotal: ${moeda(orcamento.subtotal)}`,
        195,
        finalY,
        { align: "right" }
      );

      doc.text(
        `Desconto: ${moeda(orcamento.desconto)}`,
        195,
        finalY + 8,
        { align: "right" }
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(...verde);

      doc.text(
        `TOTAL: ${moeda(orcamento.total)}`,
        195,
        finalY + 19,
        { align: "right" }
      );

      const observacoes = orcamento.observacoes || "Nenhuma.";
      let observacaoY = finalY + 35;

      if (observacaoY > 265) {
        doc.addPage();
        observacaoY = 25;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...escuro);
      doc.text("OBSERVAÇÕES", 15, observacaoY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...cinza);

      const textoObservacoes = doc.splitTextToSize(observacoes, 180);
      doc.text(textoObservacoes, 15, observacaoY + 8);

      const quantidadePaginas = doc.internal.getNumberOfPages();

      for (let pagina = 1; pagina <= quantidadePaginas; pagina++) {
        doc.setPage(pagina);
        doc.setFontSize(8);
        doc.setTextColor(...cinza);

        doc.text(
          "OrçaFácil - Documento gerado pelo sistema",
          105,
          287,
          { align: "center" }
        );
      }

      const numeroArquivo = String(
        orcamento.numero || "orcamento"
      ).replace(/[^a-zA-Z0-9-]/g, "");

      doc.save(`Orcamento-${numeroArquivo}.pdf`);
    } catch (erro) {
      console.error("Erro ao gerar PDF:", erro);
      alert("Não foi possível gerar o PDF. Verifique o console.");
    }
  }

  const statusAtual = (orcamento.status || "Pendente").toLowerCase();

  const recebimentoConcluido =
    (orcamento.statusRecebimento || "").toLowerCase() === "recebido";

  return (
    <div className="orcamentos-page">
      <div className="orcamentos-header">
        <div>
          <span className="clientes-label">GESTÃO COMERCIAL</span>
          <h1>Orçamento {orcamento.numero}</h1>
          <p>Visualize e gerencie este orçamento.</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={aoVoltar}
        >
          <ArrowLeft size={18} />
          Voltar
        </button>
      </div>

      <section className="orcamento-panel">
        <h2>
          <FileText size={19} />
          Dados do orçamento
        </h2>

        <div className="orcamento-grid">
          <div>
            <label>Número</label>
            <strong>{orcamento.numero}</strong>
          </div>

          <div>
            <label>Data de emissão</label>
            <strong>{formatarData(orcamento.dataEmissao)}</strong>
          </div>

          <div>
            <label>Validade</label>
            <strong>{orcamento.validade || "7"} dias</strong>
          </div>

          <div>
            <label>Status</label>
            <span className={`status ${statusAtual}`}>
              {orcamento.status || "Pendente"}
            </span>
          </div>

          <div>
            <label>Forma de pagamento</label>
            <strong>
              {orcamento.formaPagamento || "Não informada"}
            </strong>
          </div>
        </div>
      </section>

      {recebimentoConcluido && (
        <section className="orcamento-panel">
          <h2>
            <CheckCircle2 size={19} />
            Recebimento confirmado
          </h2>

          <div className="orcamento-grid">
            <div>
              <label>Situação do recebimento</label>
              <span className="status aprovado">Recebido</span>
            </div>

            <div>
              <label>Data do recebimento</label>
              <strong>{formatarData(orcamento.dataRecebimento)}</strong>
            </div>

            <div>
              <label>Valor recebido</label>
              <strong>{moeda(orcamento.valorRecebido)}</strong>
            </div>
          </div>
        </section>
      )}

      <section className="orcamento-panel">
        <h2>
          <Users size={19} />
          Dados do cliente
        </h2>

        <div className="orcamento-grid">
          <div>
            <label>Nome</label>
            <strong>{orcamento.cliente || "Não informado"}</strong>
          </div>

          <div>
            <label>Telefone</label>
            <strong>
              {orcamento.telefoneCliente || "Não informado"}
            </strong>
          </div>

          <div>
            <label>E-mail</label>
            <strong>
              {orcamento.emailCliente || "Não informado"}
            </strong>
          </div>
        </div>
      </section>

      <section className="orcamento-panel">
        <h2>
          <FileText size={19} />
          Serviços e materiais
        </h2>

        {itens.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>DESCRIÇÃO</th>
                  <th>QUANTIDADE</th>
                  <th>VALOR UNITÁRIO</th>
                  <th>SUBTOTAL</th>
                </tr>
              </thead>

              <tbody>
                {itens.map((item, indice) => {
                  const quantidade = Number(item.quantidade || 0);
                  const valor = Number(item.valor || 0);

                  return (
                    <tr key={item.id || indice}>
                      <td>{item.descricao}</td>
                      <td>{quantidade}</td>
                      <td>{moeda(valor)}</td>
                      <td className="value">
                        {moeda(quantidade * valor)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Nenhum item informado neste orçamento.</p>
        )}
      </section>

      <section className="orcamento-panel">
        <h2>Resumo financeiro</h2>

        <div className="orcamento-resumo">
          <div>
            <span>Subtotal</span>
            <strong>{moeda(orcamento.subtotal)}</strong>
          </div>

          <div>
            <span>Desconto</span>
            <strong>{moeda(orcamento.desconto)}</strong>
          </div>

          <div className="orcamento-total">
            <span>Valor total</span>
            <strong>{moeda(orcamento.total)}</strong>
          </div>
        </div>
      </section>

      <section className="orcamento-panel">
        <h2>Observações</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>
          {orcamento.observacoes || "Nenhuma observação informada."}
        </p>
      </section>

      <section className="orcamento-panel">
        <h2>Gerenciar orçamento</h2>

        <div className="orcamento-acoes">
          <button
            type="button"
            className="secondary-button"
            onClick={aoEditar}
          >
            <Pencil size={18} />
            Editar orçamento
          </button>

          {statusAtual !== "aprovado" && (
            <button
              type="button"
              className="primary-button"
              onClick={() => aoAlterarStatus("Aprovado")}
            >
              <Check size={18} />
              Aprovar
            </button>
          )}

          {statusAtual !== "recusado" && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                if (
                  window.confirm(
                    "Deseja realmente recusar este orçamento?"
                  )
                ) {
                  aoAlterarStatus("Recusado");
                }
              }}
            >
              <X size={18} />
              Recusar
            </button>
          )}

          {statusAtual !== "pendente" && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => aoAlterarStatus("Pendente")}
            >
              <Clock size={18} />
              Voltar para pendente
            </button>
          )}
        </div>
      </section>

      <div className="orcamento-acoes">
        <button
          type="button"
          className="secondary-button"
          onClick={aoVoltar}
        >
          <ArrowLeft size={18} />
          Voltar aos orçamentos
        </button>

        <button
          type="button"
          className="primary-button"
          onClick={gerarPDF}
        >
          <Download size={18} />
          Gerar PDF
        </button>
      </div>
    </div>
  );
}

// ========================================
// CARDS DO DASHBOARD
// ========================================

function StatCard({ icon, title, value, detail, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <span>{title}</span>
      <h2>{value}</h2>
      <small>{detail}</small>
    </div>
  );
}

export default App;
