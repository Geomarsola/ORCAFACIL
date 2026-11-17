
import { useEffect, useState } from "react";

import {
  Plus,
  Trash2,
  FileText,
  ArrowLeft,
  Calculator,
} from "lucide-react";

const API_CLIENTES = "http://localhost:3000/api/clientes";

const novoItem = () => ({
  id: Date.now() + Math.random(),
  descricao: "",
  quantidade: 1,
  valor: "",
});

function Orcamentos({
  aoVoltar,
  aoSalvar,
  orcamentoEdicao,
}) {
  const [clientes, setClientes] = useState([]);
  const [carregandoClientes, setCarregandoClientes] = useState(true);
  const [erroClientes, setErroClientes] = useState("");

  const [cliente, setCliente] = useState(
    orcamentoEdicao?.clienteId
      ? String(orcamentoEdicao.clienteId)
      : ""
  );

  const [dataEmissao, setDataEmissao] = useState(
    orcamentoEdicao?.dataEmissao ||
      new Date().toISOString().slice(0, 10)
  );

  const [validade, setValidade] = useState(
    String(orcamentoEdicao?.validade || "7")
  );

  const [itens, setItens] = useState(
    orcamentoEdicao?.itens?.length
      ? orcamentoEdicao.itens.map((item) => ({
          ...item,
          id: item.id || Date.now() + Math.random(),
        }))
      : [novoItem()]
  );

  const [desconto, setDesconto] = useState(
    String(orcamentoEdicao?.desconto ?? "0")
  );

  const [observacoes, setObservacoes] = useState(
    orcamentoEdicao?.observacoes || ""
  );

  // ========================================
  // CARREGAR CLIENTES DO MYSQL
  // ========================================

  async function carregarClientes() {
    try {
      setCarregandoClientes(true);
      setErroClientes("");

      const resposta = await fetch(API_CLIENTES);
      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.mensagem || "Não foi possível carregar os clientes."
        );
      }

      setClientes(dados);
    } catch (erro) {
      console.error("Erro ao carregar clientes:", erro);
      setErroClientes(
        erro.message || "Erro ao buscar clientes."
      );
    } finally {
      setCarregandoClientes(false);
    }
  }

  useEffect(() => {
    carregarClientes();
  }, []);

  // ========================================
  // CÁLCULOS
  // ========================================

  const subtotal = itens.reduce(
    (total, item) =>
      total +
      Number(item.quantidade || 0) *
        Number(item.valor || 0),
    0
  );

  const total = Math.max(
    0,
    subtotal - Number(desconto || 0)
  );

  // ========================================
  // ATUALIZAR ITEM
  // ========================================

  function atualizarItem(id, campo, valor) {
    setItens((atuais) =>
      atuais.map((item) =>
        item.id === id
          ? { ...item, [campo]: valor }
          : item
      )
    );
  }

  // ========================================
  // ADICIONAR ITEM
  // ========================================

  function adicionarItem() {
    setItens((atuais) => [...atuais, novoItem()]);
  }

  // ========================================
  // REMOVER ITEM
  // ========================================

  function removerItem(id) {
    setItens((atuais) =>
      atuais.length > 1
        ? atuais.filter((item) => item.id !== id)
        : atuais
    );
  }

  // ========================================
  // SALVAR ORÇAMENTO
  // ========================================

  function salvarOrcamento(evento) {
    evento.preventDefault();

    if (clientes.length === 0) {
      alert("Cadastre pelo menos um cliente antes de criar um orçamento.");
      return;
    }

    if (!cliente) {
      alert("Selecione um cliente.");
      return;
    }

    if (itens.some((item) => !item.descricao.trim())) {
      alert("Preencha a descrição de todos os itens.");
      return;
    }

    if (
      itens.some(
        (item) =>
          Number(item.quantidade) <= 0 ||
          Number(item.valor) < 0
      )
    ) {
      alert("Informe quantidades maiores que zero e valores válidos.");
      return;
    }

    if (Number(desconto) < 0) {
      alert("O desconto não pode ser negativo.");
      return;
    }

    const clienteSelecionado = clientes.find(
      (item) => String(item.id) === String(cliente)
    );

    if (!clienteSelecionado) {
      alert("O cliente selecionado não foi encontrado.");
      return;
    }

    const orcamentosSalvos = JSON.parse(
      localStorage.getItem("orcamentos") || "[]"
    );

    let numero;

    if (orcamentoEdicao) {
      numero = orcamentoEdicao.numero;
    } else {
      const maiorNumero = orcamentosSalvos.reduce(
        (maior, item) => {
          const atual = Number(
            String(item.numero || "").replace(/\D/g, "")
          );

          return Math.max(maior, atual);
        },
        0
      );

      numero = `#${String(maiorNumero + 1).padStart(4, "0")}`;
    }

    const novoOrcamento = {
      id: orcamentoEdicao?.id || Date.now(),
      numero,
      cliente: clienteSelecionado.nome,
      clienteId: clienteSelecionado.id,
      telefoneCliente: clienteSelecionado.telefone || "",
      emailCliente: clienteSelecionado.email || "",
      dataEmissao,
      validade,
      itens,
      subtotal,
      desconto: Number(desconto || 0),
      total,
      observacoes,
      status: orcamentoEdicao?.status || "Pendente",
    };

    if (aoSalvar) {
      aoSalvar(novoOrcamento);
    }

    alert(
      orcamentoEdicao
        ? `Orçamento ${numero} atualizado com sucesso!`
        : `Orçamento ${numero} criado com sucesso!`
    );
  }

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
  // TELA
  // ========================================

  return (
    <div className="orcamentos-page">
      <div className="orcamentos-header">
        <div>
          <span className="clientes-label">
            GESTÃO COMERCIAL
          </span>

          <h1>
            {orcamentoEdicao
              ? `Editar orçamento ${orcamentoEdicao.numero}`
              : "Novo orçamento"}
          </h1>

          <p>
            {orcamentoEdicao
              ? "Altere os dados e salve as atualizações."
              : "Preencha os dados para criar seu orçamento."}
          </p>
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

      <form onSubmit={salvarOrcamento}>
        <section className="orcamento-panel">
          <h2>
            <FileText size={19} />
            Dados do orçamento
          </h2>

          <div className="orcamento-grid">
            <div>
              <label>Cliente *</label>

              <select
                value={cliente}
                onChange={(evento) =>
                  setCliente(evento.target.value)
                }
                required
                disabled={
                  carregandoClientes || clientes.length === 0
                }
              >
                <option value="">
                  {carregandoClientes
                    ? "Carregando clientes..."
                    : clientes.length === 0
                      ? "Nenhum cliente cadastrado"
                      : "Selecione um cliente"}
                </option>

                {clientes.map((item) => (
                  <option
                    key={item.id}
                    value={String(item.id)}
                  >
                    {item.nome}
                  </option>
                ))}
              </select>

              {carregandoClientes && (
                <p>Buscando clientes no banco de dados...</p>
              )}

              {erroClientes && (
                <div role="alert">
                  <p>{erroClientes}</p>

                  <button
                    type="button"
                    onClick={carregarClientes}
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {!carregandoClientes &&
                !erroClientes &&
                clientes.length === 0 && (
                  <p>
                    Cadastre um cliente na tela Gestão de Clientes.
                  </p>
                )}
            </div>

            <div>
              <label>Data de emissão</label>

              <input
                type="date"
                value={dataEmissao}
                onChange={(evento) =>
                  setDataEmissao(evento.target.value)
                }
                required
              />
            </div>

            <div>
              <label>Validade</label>

              <select
                value={validade}
                onChange={(evento) =>
                  setValidade(evento.target.value)
                }
              >
                <option value="7">7 dias</option>
                <option value="15">15 dias</option>
                <option value="30">30 dias</option>
                <option value="60">60 dias</option>
              </select>
            </div>
          </div>
        </section>

        <section className="orcamento-panel">
          <div className="orcamento-itens-header">
            <div>
              <h2>
                <Calculator size={19} />
                Serviços e materiais
              </h2>

              <p>
                Adicione quantos itens forem necessários.
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={adicionarItem}
            >
              <Plus size={18} />
              Adicionar item
            </button>
          </div>

          <div className="orcamento-itens">
            {itens.map((item, indice) => (
              <div
                className="orcamento-item"
                key={item.id}
              >
                <div className="orcamento-item-titulo">
                  <strong>Item {indice + 1}</strong>

                  <button
                    type="button"
                    className="orcamento-remover"
                    onClick={() => removerItem(item.id)}
                    title="Remover item"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <div className="orcamento-grid">
                  <div className="orcamento-descricao">
                    <label>
                      Descrição do serviço ou material
                    </label>

                    <input
                      value={item.descricao}
                      onChange={(evento) =>
                        atualizarItem(
                          item.id,
                          "descricao",
                          evento.target.value
                        )
                      }
                      placeholder="Ex.: Instalação elétrica"
                      required
                    />
                  </div>

                  <div>
                    <label>Quantidade</label>

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantidade}
                      onChange={(evento) =>
                        atualizarItem(
                          item.id,
                          "quantidade",
                          evento.target.value
                        )
                      }
                      required
                    />
                  </div>

                  <div>
                    <label>Valor unitário (R$)</label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.valor}
                      onChange={(evento) =>
                        atualizarItem(
                          item.id,
                          "valor",
                          evento.target.value
                        )
                      }
                      placeholder="0,00"
                      required
                    />
                  </div>
                </div>

                <div className="orcamento-item-total">
                  Total do item:{" "}
                  <strong>
                    {moeda(
                      Number(item.quantidade || 0) *
                        Number(item.valor || 0)
                    )}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="orcamento-panel">
          <h2>Resumo financeiro</h2>

          <div className="orcamento-resumo">
            <div>
              <span>Subtotal</span>
              <strong>{moeda(subtotal)}</strong>
            </div>

            <div className="orcamento-desconto">
              <label>Desconto (R$)</label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={desconto}
                onChange={(evento) =>
                  setDesconto(evento.target.value)
                }
              />
            </div>

            <div className="orcamento-total">
              <span>Valor total</span>
              <strong>{moeda(total)}</strong>
            </div>
          </div>
        </section>

        <section className="orcamento-panel">
          <h2>Observações</h2>

          <textarea
            rows="4"
            value={observacoes}
            onChange={(evento) =>
              setObservacoes(evento.target.value)
            }
            placeholder="Condições de pagamento, detalhes do serviço..."
          />
        </section>

        <div className="orcamento-acoes">
          <button
            type="button"
            className="secondary-button"
            onClick={aoVoltar}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={
              carregandoClientes ||
              clientes.length === 0 ||
              Boolean(erroClientes)
            }
          >
            <FileText size={18} />
            {orcamentoEdicao
              ? "Salvar alterações"
              : "Salvar orçamento"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Orcamentos;
