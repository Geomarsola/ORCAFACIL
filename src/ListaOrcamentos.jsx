
import { useMemo, useState } from "react";

import {
  FileText,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Filter,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Wallet,
} from "lucide-react";

// ========================================
// FORMATAR MOEDA
// ========================================

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// ========================================
// OBTER DESCRIÇÃO DO SERVIÇO
// ========================================

function obterServico(item) {
  if (item.servico) return item.servico;

  if (!item.itens || item.itens.length === 0) {
    return "Não informado";
  }

  const primeiroServico = item.itens[0].descricao;

  if (item.itens.length === 1) {
    return primeiroServico || "Não informado";
  }

  return `${primeiroServico || "Serviço"} + ${item.itens.length - 1} item(ns)`;
}

// ========================================
// NORMALIZAR STATUS
// ========================================

function normalizarStatus(status) {
  const valor = String(status || "Pendente").toLowerCase();

  if (valor === "aprovado") return "aprovado";
  if (valor === "recusado") return "recusado";
  if (valor === "cancelado") return "recusado";

  return "pendente";
}

// ========================================
// COMPONENTE PRINCIPAL
// ========================================

function ListaOrcamentos({
  orcamentos = [],
  aoNovo,
  aoAbrir,
  aoEditar,
  aoExcluir,
  aoVoltar,
}) {
  const [pesquisa, setPesquisa] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  // ========================================
  // ORDENAR ORÇAMENTOS
  // ========================================

  const orcamentosOrdenados = useMemo(() => {
    return [...orcamentos].sort((a, b) => {
      const numeroA = Number(
        String(a.numero || "").replace(/\D/g, "")
      );

      const numeroB = Number(
        String(b.numero || "").replace(/\D/g, "")
      );

      if (numeroA !== numeroB) {
        return numeroB - numeroA;
      }

      return Number(b.id || 0) - Number(a.id || 0);
    });
  }, [orcamentos]);

  // ========================================
  // FILTRAR ORÇAMENTOS
  // ========================================

  const orcamentosFiltrados = useMemo(() => {
    const termo = pesquisa.toLowerCase().trim();

    return orcamentosOrdenados.filter((item) => {
      const numero = String(item.numero || "").toLowerCase();
      const cliente = String(item.cliente || "").toLowerCase();

      const correspondePesquisa =
        numero.includes(termo) ||
        cliente.includes(termo);

      const status = normalizarStatus(item.status);

      const correspondeStatus =
        filtroStatus === "todos" ||
        status === filtroStatus;

      return correspondePesquisa && correspondeStatus;
    });
  }, [orcamentosOrdenados, pesquisa, filtroStatus]);

  // ========================================
  // INDICADORES
  // ========================================

  const totalOrcamentos = orcamentos.length;

  const totalPendente = orcamentos.filter(
    (item) => normalizarStatus(item.status) === "pendente"
  ).length;

  const totalAprovado = orcamentos.filter(
    (item) => normalizarStatus(item.status) === "aprovado"
  ).length;

  const valorTotal = orcamentos.reduce(
    (total, item) => total + Number(item.total || 0),
    0
  );

  // ========================================
  // EXCLUIR ORÇAMENTO
  // ========================================

  function confirmarExclusao(orcamento) {
    const confirmou = window.confirm(
      `Deseja realmente excluir o orçamento ${orcamento.numero}? Esta ação não poderá ser desfeita.`
    );

    if (confirmou && typeof aoExcluir === "function") {
      aoExcluir(orcamento);
    }
  }

  // ========================================
  // TELA
  // ========================================

  return (
    <div className="orcamentos-page">
      <div className="orcamentos-header">
        <div>
          <span className="clientes-label">
            GESTÃO COMERCIAL
          </span>

          <h1>Meus orçamentos</h1>

          <p>
            Consulte, pesquise e gerencie seus orçamentos.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={aoNovo}
        >
          <Plus size={18} />
          Novo orçamento
        </button>
      </div>

      {/* INDICADORES */}

      <div className="stats">
        <div className="stat-card">
          <div className="stat-icon green">
            <FileText />
          </div>

          <span>Total de orçamentos</span>

          <h2>{totalOrcamentos}</h2>

          <small>Documentos cadastrados</small>
        </div>

        <div className="stat-card">
          <div className="stat-icon yellow">
            <Clock />
          </div>

          <span>Pendentes</span>

          <h2>{totalPendente}</h2>

          <small>Aguardando aprovação</small>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <CheckCircle2 />
          </div>

          <span>Aprovados</span>

          <h2>{totalAprovado}</h2>

          <small>Serviços aprovados</small>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <Wallet />
          </div>

          <span>Valor total</span>

          <h2 style={{ fontSize: "20px" }}>
            {moeda(valorTotal)}
          </h2>

          <small>Soma dos orçamentos</small>
        </div>
      </div>

      {/* LISTA */}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Todos os documentos</h2>

            <p>
              {orcamentosFiltrados.length} orçamento(s) encontrado(s).
            </p>
          </div>
        </div>

        {/* PESQUISA E FILTROS */}

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flex: "1",
              minWidth: "220px",
              background: "#111a17",
              border: "1px solid #26352f",
              borderRadius: "10px",
              padding: "0 14px",
            }}
          >
            <Search size={18} color="#8b9b92" />

            <input
              type="text"
              placeholder="Pesquisar por número ou cliente..."
              value={pesquisa}
              onChange={(evento) =>
                setPesquisa(evento.target.value)
              }
              style={{
                width: "100%",
                padding: "13px 0",
                border: "none",
                outline: "none",
                background: "transparent",
                color: "#f1f5f2",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "#111a17",
              border: "1px solid #26352f",
              borderRadius: "10px",
              padding: "0 12px",
            }}
          >
            <Filter size={17} color="#8b9b92" />

            <select
              value={filtroStatus}
              onChange={(evento) =>
                setFiltroStatus(evento.target.value)
              }
              style={{
                background: "transparent",
                color: "#f1f5f2",
                border: "none",
                outline: "none",
                padding: "13px 4px",
                cursor: "pointer",
              }}
            >
              <option value="todos">Todos os status</option>
              <option value="pendente">Pendentes</option>
              <option value="aprovado">Aprovados</option>
              <option value="recusado">Recusados</option>
            </select>
          </div>
        </div>

        {/* TABELA */}

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>NÚMERO</th>
                <th>CLIENTE</th>
                <th>SERVIÇO</th>
                <th>VALOR</th>
                <th>STATUS</th>
                <th>AÇÕES</th>
              </tr>
            </thead>

            <tbody>
              {orcamentosFiltrados.length > 0 ? (
                orcamentosFiltrados.map((item) => {
                  const status = normalizarStatus(item.status);

                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.numero || `#${item.id}`}</strong>
                      </td>

                      <td>
                        {item.cliente || "Não informado"}
                      </td>

                      <td>{obterServico(item)}</td>

                      <td className="value">
                        {moeda(item.total)}
                      </td>

                      <td>
                        <span className={`status ${status}`}>
                          {item.status || "Pendente"}
                        </span>
                      </td>

                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: "7px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            className="secondary-button"
                            title="Abrir orçamento"
                            onClick={() => aoAbrir?.(item)}
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            type="button"
                            className="secondary-button"
                            title="Editar orçamento"
                            onClick={() => aoEditar?.(item)}
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            className="secondary-button"
                            title="Excluir orçamento"
                            onClick={() => confirmarExclusao(item)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6">
                    <div
                      className="orcamentos-vazio"
                      style={{ padding: "45px 15px" }}
                    >
                      {orcamentos.length === 0 ? (
                        <>
                          <FileText size={32} />

                          <strong>
                            Nenhum orçamento cadastrado
                          </strong>

                          <span>
                            Crie seu primeiro orçamento para começar.
                          </span>
                        </>
                      ) : (
                        <>
                          <Search size={32} />

                          <strong>
                            Nenhum resultado encontrado
                          </strong>

                          <span>
                            Tente alterar a pesquisa ou o filtro.
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <button
        type="button"
        className="secondary-button"
        onClick={aoVoltar}
        style={{ marginTop: "18px" }}
      >
        <ArrowLeft size={18} />
        Voltar ao painel
      </button>
    </div>
  );
}

export default ListaOrcamentos;
