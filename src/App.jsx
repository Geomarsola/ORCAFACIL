
import { useState } from "react";
import "./App.css";

import Clientes from "./Clientes";
import Orcamentos from "./Orcamentos";
import ListaOrcamentos from "./ListaOrcamentos";

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
} from "lucide-react";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function carregarOrcamentos() {
  try {
    const dados = JSON.parse(
      localStorage.getItem("orcamentos") || "[]"
    );

    return Array.isArray(dados) ? dados : [];
  } catch (erro) {
    console.error("Erro ao carregar orçamentos:", erro);
    return [];
  }
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(data) {
  if (!data) return "Não informada";

  const partes = data.slice(0, 10).split("-");

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

// ========================================
// COMPONENTE PRINCIPAL
// ========================================

function App() {
  const [paginaAtual, setPaginaAtual] = useState("dashboard");
  const [orcamentoSelecionado, setOrcamentoSelecionado] = useState(null);
  const [orcamentoEdicao, setOrcamentoEdicao] = useState(null);

  const [orcamentosSalvos, setOrcamentosSalvos] = useState(
    carregarOrcamentos
  );

  // ========================================
  // ATUALIZAR LISTA DE ORÇAMENTOS
  // ========================================

  function atualizarLista(novosOrcamentos) {
    localStorage.setItem(
      "orcamentos",
      JSON.stringify(novosOrcamentos)
    );

    setOrcamentosSalvos(novosOrcamentos);
  }

  // ========================================
  // NAVEGAÇÃO
  // ========================================

  function abrirPagina(pagina) {
    setPaginaAtual(pagina);
  }

  function abrirOrcamento(orcamento) {
    setOrcamentoSelecionado(orcamento);
    setPaginaAtual("detalhes-orcamento");
  }

  function voltarDashboard() {
    setOrcamentoSelecionado(null);
    setOrcamentoEdicao(null);
    setPaginaAtual("dashboard");
  }

  // ========================================
  // EDITAR ORÇAMENTO
  // ========================================

  function editarOrcamento(orcamento) {
    setOrcamentoSelecionado(orcamento);
    setOrcamentoEdicao(orcamento);
    setPaginaAtual("orcamentos");
  }

  // ========================================
  // SALVAR ORÇAMENTO
  // ========================================

  function salvarOrcamento(orcamento) {
    const existe = orcamentosSalvos.some(
      (item) => item.id === orcamento.id
    );

    let novaLista;

    if (existe) {
      novaLista = orcamentosSalvos.map((item) =>
        item.id === orcamento.id ? orcamento : item
      );
    } else {
      novaLista = [...orcamentosSalvos, orcamento];
    }

    atualizarLista(novaLista);

    setOrcamentoSelecionado(orcamento);
    setOrcamentoEdicao(null);
    setPaginaAtual("detalhes-orcamento");
  }

  // ========================================
  // ALTERAR STATUS
  // ========================================

  function alterarStatus(orcamento, novoStatus) {
    const atualizado = {
      ...orcamento,
      status: novoStatus,
    };

    const novaLista = orcamentosSalvos.map((item) =>
      item.id === orcamento.id ? atualizado : item
    );

    atualizarLista(novaLista);
    setOrcamentoSelecionado(atualizado);
  }

  // ========================================
  // EXCLUIR ORÇAMENTO
  // ========================================

  function excluirOrcamento(orcamento) {
    const novaLista = orcamentosSalvos.filter(
      (item) => item.id !== orcamento.id
    );

    atualizarLista(novaLista);

    setOrcamentoSelecionado(null);
    setOrcamentoEdicao(null);
    setPaginaAtual("lista-orcamentos");
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

        <div className="menu-label">MENU PRINCIPAL</div>

        <nav className="menu">
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
              ["lista-orcamentos", "orcamentos", "detalhes-orcamento"].includes(
                paginaAtual
              )
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

          <a className="menu-item" href="#recibos">
            <Receipt size={19} />
            Recibos
          </a>
        </nav>

        <div className="sidebar-bottom">
          <a className="menu-item" href="#configuracoes">
            <Settings size={19} />
            Configurações
          </a>

          <div className="profile">
            <div className="avatar">OF</div>

            <div>
              <strong>Minha empresa</strong>
              <span>Plano gratuito</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="mobile-brand">
            <Menu size={23} />
            <strong>OrçaFácil</strong>
          </div>

          <div className="search-box">
            <Search size={18} />
            <input placeholder="Pesquisar..." />
          </div>

          <button
            type="button"
            className="notification"
            aria-label="Notificações"
          >
            <Bell size={20} />
          </button>
        </header>

        <section className="content">

          {/* ========================================
              LISTA DE ORÇAMENTOS
          ======================================== */}

          {paginaAtual === "lista-orcamentos" ? (
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

            /* ========================================
               FORMULÁRIO DE ORÇAMENTO
            ======================================== */

            <Orcamentos
              key={orcamentoEdicao?.id || "novo"}
              orcamentoEdicao={orcamentoEdicao}
              aoSalvar={salvarOrcamento}
              aoVoltar={() => {
                if (orcamentoEdicao) {
                  setOrcamentoEdicao(null);
                  setPaginaAtual("detalhes-orcamento");
                } else {
                  setPaginaAtual("lista-orcamentos");
                }
              }}
            />

          ) : paginaAtual === "clientes" ? (

            <Clientes />

          ) : paginaAtual === "detalhes-orcamento" &&
            orcamentoSelecionado ? (

            /* ========================================
               DETALHES DO ORÇAMENTO
            ======================================== */

            <DetalhesOrcamento
              orcamento={orcamentoSelecionado}
              aoVoltar={() => {
                setOrcamentoSelecionado(null);
                setPaginaAtual("lista-orcamentos");
              }}
              aoEditar={() => editarOrcamento(orcamentoSelecionado)}
              aoAlterarStatus={(status) =>
                alterarStatus(orcamentoSelecionado, status)
              }
            />

          ) : (

            /* ========================================
               DASHBOARD
            ======================================== */

            <>
              <div className="welcome">
                <div>
                  <span className="date-label">
                    PAINEL DE CONTROLE
                  </span>

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
                    <h2>Orçamentos recentes</h2>
                    <p>
                      Acompanhe seus últimos documentos.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => abrirPagina("lista-orcamentos")}
                  >
                    Ver todos
                  </button>
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
                      {orcamentosRecentes.length > 0 ? (
                        orcamentosRecentes.map((item) => (
                          <tr key={item.id}>
                            <td>{item.numero}</td>

                            <td>
                              {item.cliente || "Não informado"}
                            </td>

                            <td>{obterServico(item)}</td>

                            <td className="value">
                              {moeda(item.total)}
                            </td>

                            <td>
                              <span
                                className={`status ${
                                  (
                                    item.status || "Pendente"
                                  ).toLowerCase()
                                }`}
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
                              <FileText size={30} />

                              <strong>
                                Nenhum orçamento cadastrado
                              </strong>

                              <span>
                                Clique em Novo orçamento para começar.
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
                  <h3>
                    Organize seus serviços com facilidade!
                  </h3>

                  <p>
                    Crie orçamentos profissionais e mantenha seus
                    clientes sempre organizados.
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

      doc.setTextColor(...escuro);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("DADOS DO CLIENTE", 15, 77);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      doc.text(
        `Nome: ${orcamento.cliente || "Não informado"}`,
        15,
        85
      );

      doc.text(
        `Telefone: ${orcamento.telefoneCliente || "Não informado"}`,
        15,
        92
      );

      doc.text(
        `E-mail: ${orcamento.emailCliente || "Não informado"}`,
        15,
        99
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
        startY: 110,
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

      const textoObservacoes = doc.splitTextToSize(
        observacoes,
        180
      );

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

  const statusAtual = (
    orcamento.status || "Pendente"
  ).toLowerCase();

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
        </div>
      </section>

      <section className="orcamento-panel">
        <h2>
          <Users size={19} />
          Dados do cliente
        </h2>

        <div className="orcamento-grid">
          <div>
            <label>Nome</label>
            <strong>
              {orcamento.cliente || "Não informado"}
            </strong>
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
      <div className={`stat-icon ${color}`}>
        {icon}
      </div>

      <span>{title}</span>
      <h2>{value}</h2>
      <small>{detail}</small>
    </div>
  );
}

export default App;
