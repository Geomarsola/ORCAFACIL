
import { useEffect, useState } from "react";

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

const API = "http://localhost:3000/api/clientes";

const formularioVazio = {
  nome: "",
  telefone: "",
  email: "",
  documento: "",
  endereco: "",
  observacoes: "",
};

// ========================================
// TRATAMENTO PADRÃO DAS RESPOSTAS
// ========================================

async function lerResposta(resposta) {
  const texto = await resposta.text();

  let dados = {};

  try {
    dados = texto ? JSON.parse(texto) : {};
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }

  if (!resposta.ok) {
    throw new Error(
      dados.mensagem ||
      dados.erro ||
      "Não foi possível concluir a operação."
    );
  }

  return dados;
}

function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [formulario, setFormulario] = useState({ ...formularioVazio });

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // ========================================
  // CARREGAR CLIENTES DO MYSQL
  // ========================================

  async function carregarClientes() {
    try {
      setCarregando(true);
      setErro("");

      const resposta = await fetch(API, {
        method: "GET",
        credentials: "include",
      });

      const dados = await lerResposta(resposta);

      setClientes(Array.isArray(dados) ? dados : []);
    } catch (erro) {
      console.error("Erro ao carregar clientes:", erro);

      setErro(
        erro.message ||
        "Não foi possível carregar os clientes."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarClientes();
  }, []);

  // ========================================
  // BUSCA
  // ========================================

  const clientesFiltrados = clientes.filter((cliente) =>
    `${cliente.nome || ""} ${cliente.telefone || ""} ${cliente.email || ""} ${cliente.documento || ""}`
      .toLowerCase()
      .includes(busca.toLowerCase())
  );

  // ========================================
  // ABRIR CADASTRO
  // ========================================

  function abrirCadastro() {
    setClienteEditando(null);
    setFormulario({ ...formularioVazio });
    setErro("");
    setModalAberto(true);
  }

  // ========================================
  // EDITAR CLIENTE
  // ========================================

  function editarCliente(cliente) {
    setClienteEditando(cliente.id);

    setFormulario({
      nome: cliente.nome || "",
      telefone: cliente.telefone || "",
      email: cliente.email || "",
      documento: cliente.documento || "",
      endereco: cliente.endereco || "",
      observacoes: cliente.observacoes || "",
    });

    setErro("");
    setModalAberto(true);
  }

  // ========================================
  // ALTERAR CAMPOS
  // ========================================

  function alterarCampo(evento) {
    const { name, value } = evento.target;

    setFormulario((atual) => ({
      ...atual,
      [name]: value,
    }));
  }

  // ========================================
  // SALVAR CLIENTE NO MYSQL
  // ========================================

  async function salvarCliente(evento) {
    evento.preventDefault();

    if (!formulario.nome.trim()) {
      setErro("Informe o nome do cliente.");
      return;
    }

    try {
      setSalvando(true);
      setErro("");

      const editando = clienteEditando !== null;

      const url = editando
        ? `${API}/${clienteEditando}`
        : API;

      const resposta = await fetch(url, {
        method: editando ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          ...formulario,
          nome: formulario.nome.trim(),
        }),
      });

      const dados = await lerResposta(resposta);

      if (!dados.cliente) {
        throw new Error(
          "O servidor não retornou os dados do cliente."
        );
      }

      if (editando) {
        setClientes((atual) =>
          atual.map((cliente) =>
            cliente.id === clienteEditando
              ? dados.cliente
              : cliente
          )
        );
      } else {
        setClientes((atual) => [
          dados.cliente,
          ...atual,
        ]);
      }

      setModalAberto(false);
      setFormulario({ ...formularioVazio });
      setClienteEditando(null);

      alert(dados.mensagem || "Cliente salvo com sucesso!");
    } catch (erro) {
      console.error("Erro ao salvar cliente:", erro);

      setErro(
        erro.message ||
        "Não foi possível salvar o cliente."
      );
    } finally {
      setSalvando(false);
    }
  }

  // ========================================
  // EXCLUIR CLIENTE DO MYSQL
  // ========================================

  async function excluirCliente(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir este cliente?"
    );

    if (!confirmar) return;

    try {
      const resposta = await fetch(`${API}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const dados = await lerResposta(resposta);

      setClientes((atual) =>
        atual.filter((cliente) => cliente.id !== id)
      );

      alert(dados.mensagem || "Cliente excluído com sucesso!");
    } catch (erro) {
      console.error("Erro ao excluir cliente:", erro);

      alert(
        erro.message ||
        "Não foi possível excluir o cliente."
      );
    }
  }

  // ========================================
  // FECHAR MODAL
  // ========================================

  function fecharModal() {
    if (salvando) return;

    setModalAberto(false);
    setFormulario({ ...formularioVazio });
    setClienteEditando(null);
    setErro("");
  }

  // ========================================
  // TELA
  // ========================================

  return (
    <div className="clientes-page">
      <div className="clientes-header">
        <div>
          <span className="clientes-label">
            GESTÃO DE CLIENTES
          </span>

          <h1>Clientes</h1>

          <p>Gerencie os contatos dos seus clientes.</p>
        </div>

        <button
          className="cliente-novo-btn"
          onClick={abrirCadastro}
          type="button"
        >
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

        {erro && !modalAberto && (
          <div className="clientes-vazio" role="alert">
            {erro}

            <button
              type="button"
              onClick={carregarClientes}
              disabled={carregando}
            >
              Tentar novamente
            </button>
          </div>
        )}

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
              {carregando ? (
                <tr>
                  <td colSpan="5" className="clientes-vazio">
                    Carregando clientes...
                  </td>
                </tr>
              ) : clientesFiltrados.map((cliente) => (
                <tr key={cliente.id}>
                  <td>
                    <strong>{cliente.nome}</strong>

                    <small>
                      {cliente.documento || "Sem documento"}
                    </small>
                  </td>

                  <td>
                    {cliente.telefone || "Não informado"}
                  </td>

                  <td>
                    {cliente.email || "Não informado"}
                  </td>

                  <td>
                    {cliente.endereco || "Não informado"}
                  </td>

                  <td>
                    <div className="cliente-acoes">
                      <button
                        type="button"
                        title="Editar cliente"
                        onClick={() => editarCliente(cliente)}
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        type="button"
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

              {!carregando &&
                clientesFiltrados.length === 0 &&
                !erro && (
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
                  {clienteEditando !== null
                    ? "Editar cliente"
                    : "Novo cliente"}
                </h2>

                <p>Preencha os dados do cliente.</p>
              </div>

              <button
                type="button"
                onClick={fecharModal}
                disabled={salvando}
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

              {erro && (
                <p role="alert" className="clientes-vazio">
                  {erro}
                </p>
              )}

              <div className="cliente-modal-actions">
                <button
                  type="button"
                  className="cliente-cancelar"
                  onClick={fecharModal}
                  disabled={salvando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="cliente-salvar"
                  disabled={salvando}
                >
                  {salvando
                    ? "Salvando..."
                    : clienteEditando !== null
                      ? "Salvar alterações"
                      : "Cadastrar cliente"}
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
