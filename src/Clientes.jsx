
import { useState } from "react";
import {
  Plus,
  Search,
  Users,
  Pencil,
  Trash2,
  X,
  Phone,
  Mail,
  MapPin,
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

const formularioVazio = {
  nome: "",
  telefone: "",
  email: "",
  documento: "",
  endereco: "",
  observacoes: "",
};

function Clientes() {
  const [clientes, setClientes] = useState(clientesIniciais);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVazio);

  const clientesFiltrados = clientes.filter((cliente) =>
    `${cliente.nome} ${cliente.telefone} ${cliente.email}`
      .toLowerCase()
      .includes(busca.toLowerCase())
  );

  function abrirCadastro() {
    setClienteEditando(null);
    setFormulario(formularioVazio);
    setModalAberto(true);
  }

  function editarCliente(cliente) {
    setClienteEditando(cliente.id);
    setFormulario({ ...cliente });
    setModalAberto(true);
  }

  function alterarCampo(evento) {
    const { name, value } = evento.target;

    setFormulario((atual) => ({
      ...atual,
      [name]: value,
    }));
  }

  function salvarCliente(evento) {
    evento.preventDefault();

    if (!formulario.nome.trim()) {
      alert("Informe o nome do cliente.");
      return;
    }

    if (clienteEditando) {
      setClientes((atual) =>
        atual.map((cliente) =>
          cliente.id === clienteEditando
            ? { ...formulario, id: clienteEditando }
            : cliente
        )
      );
    } else {
      const novoCliente = {
        ...formulario,
        id: Date.now(),
      };

      setClientes((atual) => [...atual, novoCliente]);
    }

    setModalAberto(false);
    setFormulario(formularioVazio);
    setClienteEditando(null);
  }

  function excluirCliente(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir este cliente?"
    );

    if (!confirmar) return;

    setClientes((atual) =>
      atual.filter((cliente) => cliente.id !== id)
    );
  }

  return (
    <div className="clientes-page">
      <div className="clientes-header">
        <div>
          <span className="clientes-label">GESTÃO DE CLIENTES</span>
          <h1>Clientes</h1>
          <p>Gerencie os contatos dos seus clientes.</p>
        </div>

        <button className="cliente-novo-btn" onClick={abrirCadastro}>
          <Plus size={19} />
          Novo cliente
        </button>
      </div>

      <div className="clientes-resumo">
        <div className="cliente-resumo-icon">
          <Users size={23} />
        </div>

        <div>
          <span>Total de clientes</span>
          <h2>{clientes.length}</h2>
        </div>
      </div>

      <div className="clientes-lista-panel">
        <div className="clientes-lista-header">
          <div>
            <h2>Todos os clientes</h2>
            <p>Consulte e gerencie seus cadastros.</p>
          </div>

          <div className="clientes-busca">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </div>
        </div>

        <div className="clientes-tabela-container">
          <table className="clientes-tabela">
            <thead>
              <tr>
                <th>CLIENTE</th>
                <th>TELEFONE</th>
                <th>E-MAIL</th>
                <th>ENDEREÇO</th>
                <th>AÇÕES</th>
              </tr>
            </thead>

            <tbody>
              {clientesFiltrados.map((cliente) => (
                <tr key={cliente.id}>
                  <td>
                    <strong>{cliente.nome}</strong>
                    <small>{cliente.documento || "Sem documento"}</small>
                  </td>

                  <td>{cliente.telefone || "Não informado"}</td>
                  <td>{cliente.email || "Não informado"}</td>
                  <td>{cliente.endereco || "Não informado"}</td>

                  <td>
                    <div className="cliente-acoes">
                      <button
                        title="Editar cliente"
                        onClick={() => editarCliente(cliente)}
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        className="excluir"
                        title="Excluir cliente"
                        onClick={() => excluirCliente(cliente.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {clientesFiltrados.length === 0 && (
                <tr>
                  <td colSpan="5" className="clientes-vazio">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalAberto && (
        <div className="cliente-modal-overlay">
          <div className="cliente-modal">
            <div className="cliente-modal-header">
              <div>
                <h2>
                  {clienteEditando ? "Editar cliente" : "Novo cliente"}
                </h2>
                <p>Preencha os dados do cliente.</p>
              </div>

              <button
                type="button"
                onClick={() => setModalAberto(false)}
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={salvarCliente}>
              <label>Nome completo *</label>
              <input
                name="nome"
                value={formulario.nome}
                onChange={alterarCampo}
                placeholder="Digite o nome completo"
                required
              />

              <div className="cliente-form-grid">
                <div>
                  <label>Telefone / WhatsApp</label>
                  <div className="cliente-input-icon">
                    <Phone size={17} />
                    <input
                      name="telefone"
                      value={formulario.telefone}
                      onChange={alterarCampo}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                <div>
                  <label>CPF / CNPJ</label>
                  <input
                    name="documento"
                    value={formulario.documento}
                    onChange={alterarCampo}
                    placeholder="Documento"
                  />
                </div>
              </div>

              <label>E-mail</label>
              <div className="cliente-input-icon">
                <Mail size={17} />
                <input
                  type="email"
                  name="email"
                  value={formulario.email}
                  onChange={alterarCampo}
                  placeholder="cliente@email.com"
                />
              </div>

              <label>Endereço</label>
              <div className="cliente-input-icon">
                <MapPin size={17} />
                <input
                  name="endereco"
                  value={formulario.endereco}
                  onChange={alterarCampo}
                  placeholder="Rua, número, cidade e estado"
                />
              </div>

              <label>Observações</label>
              <textarea
                name="observacoes"
                value={formulario.observacoes}
                onChange={alterarCampo}
                placeholder="Informações adicionais..."
                rows="3"
              />

              <div className="cliente-modal-actions">
                <button
                  type="button"
                  className="cliente-cancelar"
                  onClick={() => setModalAberto(false)}
                >
                  Cancelar
                </button>

                <button type="submit" className="cliente-salvar">
                  {clienteEditando ? "Salvar alterações" : "Cadastrar cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clientes;
