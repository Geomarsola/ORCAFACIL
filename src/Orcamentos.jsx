
import { useState } from "react";
import {
  Plus,
  Trash2,
  FileText,
  ArrowLeft,
  Calculator,
} from "lucide-react";

const clientesIniciais = [
  {
    id: 1,
    nome: "João da Silva",
    telefone: "(14) 99999-1111",
    email: "joao@email.com",
    documento: "123.456.789-00",
    endereco: "Lins - SP",
    observacoes: "",
  },
  {
    id: 2,
    nome: "Maria Oliveira",
    telefone: "(14) 98888-2222",
    email: "maria@email.com",
    documento: "987.654.321-00",
    endereco: "Marília - SP",
    observacoes: "",
  },
];

const novoItem = () => ({
  id: Date.now() + Math.random(),
  descricao: "",
  quantidade: 1,
  valor: "",
});

function Orcamentos({ aoVoltar }) {
  const [cliente, setCliente] = useState("");
  const [dataEmissao, setDataEmissao] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [validade, setValidade] = useState("7");
  const [itens, setItens] = useState([novoItem()]);
  const [desconto, setDesconto] = useState("0");
  const [observacoes, setObservacoes] = useState("");

  const clientesSalvos = JSON.parse(
    localStorage.getItem("clientes") || "null"
  ) || clientesIniciais;

  const subtotal = itens.reduce(
    (total, item) =>
      total +
      Number(item.quantidade || 0) * Number(item.valor || 0),
    0
  );

  const total = Math.max(0, subtotal - Number(desconto || 0));

  function atualizarItem(id, campo, valor) {
    setItens((atuais) =>
      atuais.map((item) =>
        item.id === id ? { ...item, [campo]: valor } : item
      )
    );
  }

  function adicionarItem() {
    setItens((atuais) => [...atuais, novoItem()]);
  }

  function removerItem(id) {
    setItens((atuais) =>
      atuais.length > 1
        ? atuais.filter((item) => item.id !== id)
        : atuais
    );
  }

  function salvarOrcamento(evento) {
    evento.preventDefault();

    if (!cliente) {
      alert("Selecione um cliente.");
      return;
    }

    if (itens.some((item) => !item.descricao.trim())) {
      alert("Preencha a descrição de todos os itens.");
      return;
    }

    const orcamentosSalvos = JSON.parse(
      localStorage.getItem("orcamentos") || "[]"
    );

    const numero = String(orcamentosSalvos.length + 1).padStart(4, "0");

    const novoOrcamento = {
      id: Date.now(),
      numero: `#${numero}`,
      cliente: clientesSalvos.find(
        (item) => String(item.id) === cliente
      )?.nome,
      clienteId: cliente,
      dataEmissao,
      validade,
      itens,
      subtotal,
      desconto: Number(desconto || 0),
      total,
      observacoes,
      status: "Pendente",
    };

    localStorage.setItem(
      "orcamentos",
      JSON.stringify([...orcamentosSalvos, novoOrcamento])
    );

    alert(`Orçamento ${novoOrcamento.numero} salvo com sucesso!`);
    setCliente("");
    setItens([novoItem()]);
    setDesconto("0");
    setObservacoes("");
  }

  function moeda(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  return (
    <div className="orcamentos-page">
      <div className="orcamentos-header">
        <div>
          <span className="clientes-label">GESTÃO COMERCIAL</span>
          <h1>Novo orçamento</h1>
          <p>Preencha os dados para criar seu orçamento.</p>
        </div>

        <button className="secondary-button" onClick={aoVoltar}>
          <ArrowLeft size={18} />
          Voltar
        </button>
      </div>

      <form onSubmit={salvarOrcamento}>
        <section className="orcamento-panel">
          <h2><FileText size={19} /> Dados do orçamento</h2>

          <div className="orcamento-grid">
            <div>
              <label>Cliente *</label>
              <select
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                required
              >
                <option value="">Selecione um cliente</option>
                {clientesSalvos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Data de emissão</label>
              <input
                type="date"
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
                required
              />
            </div>

            <div>
              <label>Validade</label>
              <select
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
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
              <h2><Calculator size={19} /> Serviços e materiais</h2>
              <p>Adicione quantos itens forem necessários.</p>
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
              <div className="orcamento-item" key={item.id}>
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
                    <label>Descrição do serviço ou material</label>
                    <input
                      value={item.descricao}
                      onChange={(e) =>
                        atualizarItem(item.id, "descricao", e.target.value)
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
                      onChange={(e) =>
                        atualizarItem(item.id, "quantidade", e.target.value)
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
                      onChange={(e) =>
                        atualizarItem(item.id, "valor", e.target.value)
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
                onChange={(e) => setDesconto(e.target.value)}
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
            onChange={(e) => setObservacoes(e.target.value)}
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

          <button type="submit" className="primary-button">
            <FileText size={18} />
            Salvar orçamento
          </button>
        </div>
      </form>
    </div>
  );
}

export default Orcamentos;
