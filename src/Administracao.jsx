
import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Search,
  Power,
  RefreshCw,
  X,
  CheckCircle2,
  CreditCard,
  Pencil,
  Save,
  Tag,
  Trash2,
} from "lucide-react";

const API_URL = "http://localhost:3000/api";

async function requisicaoAdmin(url, opcoes = {}) {
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
    throw new Error(
      dados.mensagem || "Não foi possível realizar a operação."
    );
  }

  return dados;
}

export default function Administracao() {
  const [abaAtual, setAbaAtual] = useState("usuarios");

  const [usuarios, setUsuarios] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [carregandoPagamentos, setCarregandoPagamentos] = useState(true);
  const [confirmandoPagamento, setConfirmandoPagamento] = useState(null);

  const [pesquisa, setPesquisa] = useState("");

  const [carregando, setCarregando] = useState(true);
  const [carregandoPlanos, setCarregandoPlanos] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState(null);

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [planoEmEdicao, setPlanoEmEdicao] = useState(null);

  const [formulario, setFormulario] = useState({
    nome: "",
    email: "",
    senha: "",
    plano_id: "",
  });

  const [formularioPlano, setFormularioPlano] = useState({
    nome: "",
    periodicidade: "mensal",
    valor: "",
  });

  async function carregarUsuarios() {
    setCarregando(true);

    try {
      const dados = await requisicaoAdmin("/admin/clientes");

      if (dados.sucesso && Array.isArray(dados.clientes)) {
        setUsuarios(dados.clientes);
      } else {
        setUsuarios([]);
        setErro("O servidor não retornou a lista de clientes corretamente.");
      }
    } catch (erro) {
      setUsuarios([]);
      setErro(erro.message || "Não foi possível carregar os usuários.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarPlanos() {
    setCarregandoPlanos(true);

    try {
      const dados = await requisicaoAdmin("/admin/planos");

      if (dados.sucesso && Array.isArray(dados.planos)) {
        setPlanos(dados.planos);
      } else {
        setPlanos([]);
        setErro("Não foi possível carregar os planos cadastrados.");
      }
    } catch (erro) {
      setPlanos([]);
      setErro(erro.message || "Não foi possível carregar os planos.");
    } finally {
      setCarregandoPlanos(false);
    }
  }

  async function carregarPagamentos() {
    setCarregandoPagamentos(true);

    try {
      const dados = await requisicaoAdmin("/admin/pagamentos");

      if (dados.sucesso && Array.isArray(dados.pagamentos)) {
        setPagamentos(dados.pagamentos);
      } else {
        setPagamentos([]);
        setErro("Não foi possível carregar os pagamentos.");
      }
    } catch (erro) {
      setPagamentos([]);
      setErro(erro.message || "Não foi possível carregar os pagamentos.");
    } finally {
      setCarregandoPagamentos(false);
    }
  }

  async function confirmarPagamento(pagamento) {
    const confirmar = window.confirm(
      `Confirma o recebimento de ${formatarValor(pagamento.valor)} ` +
      `do cliente ${pagamento.cliente}?\n\n` +
      "O pagamento será aprovado e a assinatura será ativada."
    );

    if (!confirmar) return;

    setErro("");
    setSucesso("");
    setConfirmandoPagamento(pagamento.id);

    try {
      const dados = await requisicaoAdmin(
        `/admin/pagamentos/${pagamento.id}/confirmar`,
        {
          method: "PATCH",
        }
      );

      setSucesso(
        dados.mensagem || "Pagamento confirmado com sucesso!"
      );

      await carregarPagamentos();
    } catch (erro) {
      setErro(erro.message || "Não foi possível confirmar o pagamento.");
    } finally {
      setConfirmandoPagamento(null);
    }
  }

  useEffect(() => {
    carregarUsuarios();
    carregarPlanos();
    carregarPagamentos();
  }, []);

  function atualizarCampo(campo, valor) {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  function formatarValor(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarDataPlano(data) {
    if (!data) return "—";

    const texto = String(data);
    const parteData = texto.slice(0, 10);
    const [ano, mes, dia] = parteData.split("-");

    if (!ano || !mes || !dia) return "—";

    return `${dia}/${mes}/${ano}`;
  }

  function descricaoPlano(plano) {
    if (plano.periodicidade === "gratuito") return "Gratuito";
    if (plano.periodicidade === "mensal") return "por mês";
    if (plano.periodicidade === "anual") return "por ano";
    return "";
  }

  function nomePeriodicidade(periodicidade) {
    if (periodicidade === "gratuito") return "Gratuito";
    if (periodicidade === "mensal") return "Mensal";
    if (periodicidade === "anual") return "Anual";
    return periodicidade;
  }

  async function criarUsuario(e) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    if (
      !formulario.nome.trim() ||
      !formulario.email.trim() ||
      !formulario.senha ||
      !formulario.plano_id
    ) {
      setErro("Preencha todos os campos e selecione um plano.");
      return;
    }

    if (formulario.senha.length < 8) {
      setErro("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    setSalvando(true);

    try {
      await requisicaoAdmin("/admin/clientes", {
        method: "POST",
        body: JSON.stringify({
          nome: formulario.nome.trim(),
          email: formulario.email.trim(),
          senha: formulario.senha,
          plano_id: Number(formulario.plano_id),
        }),
      });

      setFormulario({
        nome: "",
        email: "",
        senha: "",
        plano_id: "",
      });

      setModalAberto(false);
      setSucesso("Usuário criado e plano vinculado com sucesso!");

      await carregarUsuarios();
    } catch (erro) {
      setErro(erro.message || "Não foi possível criar o usuário.");
    } finally {
      setSalvando(false);
    }
  }

  async function alterarStatus(usuario) {
    const ativo = Number(usuario.ativo) === 1;
    const acao = ativo ? "desativar" : "ativar";

    const confirmar = window.confirm(
      `Deseja realmente ${acao} o acesso de ${usuario.nome}?`
    );

    if (!confirmar) return;

    setErro("");
    setSucesso("");

    try {
      await requisicaoAdmin(`/admin/clientes/${usuario.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          ativo: !ativo,
        }),
      });

      setSucesso(
        ativo
          ? "Usuário desativado com sucesso."
          : "Usuário ativado com sucesso."
      );

      await carregarUsuarios();
    } catch (erro) {
      setErro(erro.message || "Não foi possível alterar o acesso.");
    }
  }

  async function excluirUsuario(usuario) {
    const confirmar = window.confirm(
      `Deseja realmente excluir o cliente "${usuario.nome}"?\n\n` +
      "O que acontecerá:\n" +
      "- O acesso do cliente será bloqueado;\n" +
      "- O cliente sairá da listagem administrativa;\n" +
      "- As assinaturas serão preservadas;\n" +
      "- Os pagamentos serão preservados.\n\n" +
      "Essa ação não poderá ser desfeita pela tela de administração."
    );

    if (!confirmar) return;

    setErro("");
    setSucesso("");
    setExcluindoId(usuario.id);

    try {
      const dados = await requisicaoAdmin(
        `/admin/clientes/${usuario.id}`,
        {
          method: "DELETE",
        }
      );

      setSucesso(
        dados.mensagem ||
        `Cliente "${usuario.nome}" excluído com sucesso!`
      );

      await carregarUsuarios();
    } catch (erro) {
      setErro(erro.message || "Não foi possível excluir o cliente.");
    } finally {
      setExcluindoId(null);
    }
  }

  function iniciarEdicaoPlano(plano) {
    setErro("");
    setSucesso("");

    setPlanoEmEdicao(plano.id);

    setFormularioPlano({
      nome: plano.nome || "",
      periodicidade: plano.periodicidade || "mensal",
      valor: String(plano.valor ?? 0),
    });
  }

  function cancelarEdicaoPlano() {
    setPlanoEmEdicao(null);

    setFormularioPlano({
      nome: "",
      periodicidade: "mensal",
      valor: "",
    });
  }

  async function salvarPlano(e, plano) {
    e.preventDefault();
    setErro("");
    setSucesso("");

    const nome = formularioPlano.nome.trim();
    const periodicidade = formularioPlano.periodicidade;
    const valor = Number(
      String(formularioPlano.valor).replace(",", ".")
    );

    if (!nome) {
      setErro("Informe o nome do plano.");
      return;
    }

    if (!Number.isFinite(valor) || valor < 0) {
      setErro("Informe um valor válido para o plano.");
      return;
    }

    if (periodicidade === "gratuito" && valor !== 0) {
      setErro("O plano gratuito precisa ter valor igual a R$ 0,00.");
      return;
    }

    if (periodicidade !== "gratuito" && valor <= 0) {
      setErro("Os planos pagos precisam ter um valor maior que zero.");
      return;
    }

    setSalvando(true);

    try {
      await requisicaoAdmin(`/admin/planos/${plano.id}`, {
        method: "PUT",
        body: JSON.stringify({
          nome,
          periodicidade,
          valor,
        }),
      });

      setSucesso(`Plano "${nome}" atualizado com sucesso!`);
      cancelarEdicaoPlano();

      await carregarPlanos();
    } catch (erro) {
      setErro(erro.message || "Não foi possível atualizar o plano.");
    } finally {
      setSalvando(false);
    }
  }

  async function alterarStatusPlano(plano) {
    const ativo = Number(plano.ativo) === 1;
    const acao = ativo ? "desativar" : "ativar";

    const confirmar = window.confirm(
      `Deseja realmente ${acao} o plano "${plano.nome}"?`
    );

    if (!confirmar) return;

    setErro("");
    setSucesso("");

    try {
      await requisicaoAdmin(`/admin/planos/${plano.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          ativo: !ativo,
        }),
      });

      setSucesso(
        ativo
          ? "Plano desativado com sucesso."
          : "Plano ativado com sucesso."
      );

      await carregarPlanos();
    } catch (erro) {
      setErro(erro.message || "Não foi possível alterar o plano.");
    }
  }

  const termo = pesquisa.trim().toLowerCase();

  const usuariosFiltrados = usuarios.filter((usuario) => {
    return (
      String(usuario.nome || "").toLowerCase().includes(termo) ||
      String(usuario.email || "").toLowerCase().includes(termo)
    );
  });

  const usuariosAtivos = usuarios.filter(
    (usuario) => Number(usuario.ativo) === 1
  ).length;

  const usuariosInativos = usuarios.length - usuariosAtivos;

  const planosAtivos = planos.filter(
    (plano) => Number(plano.ativo) === 1
  );

  return (
    <div className="orcamentos-page">
      <div className="orcamentos-header">
        <div>
          <span className="clientes-label">ÁREA RESTRITA</span>
          <h1>Administração</h1>
          <p>
            Gerencie os clientes e os planos do OrçaFácil.
          </p>
        </div>

        {abaAtual === "usuarios" && (
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setErro("");
              setSucesso("");
              setFormulario({
                nome: "",
                email: "",
                senha: "",
                plano_id: "",
              });
              setModalAberto(true);
            }}
          >
            <UserPlus size={18} />
            Criar usuário
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 22,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className={abaAtual === "usuarios" ? "primary-button" : "secondary-button"}
          onClick={() => {
            setAbaAtual("usuarios");
            setErro("");
            setSucesso("");
          }}
        >
          <Users size={17} />
          Usuários
        </button>

        <button
          type="button"
          className={abaAtual === "planos" ? "primary-button" : "secondary-button"}
          onClick={() => {
            setAbaAtual("planos");
            setErro("");
            setSucesso("");
          }}
        >
          <CreditCard size={17} />
          Planos
        </button>

        <button
          type="button"
          className={
            abaAtual === "pagamentos"
              ? "primary-button"
              : "secondary-button"
          }
          onClick={() => {
            setAbaAtual("pagamentos");
            setErro("");
            setSucesso("");
            carregarPagamentos();
          }}
        >
          <CreditCard size={17} />
          Pagamentos
        </button>
      </div>

      {erro && (
        <div className="login-error" style={{ marginBottom: 18 }}>
          {erro}
        </div>
      )}

      {sucesso && (
        <div
          style={{
            padding: "13px 16px",
            marginBottom: 18,
            borderRadius: 10,
            background: "rgba(22, 163, 74, 0.10)",
            color: "#16a34a",
            fontWeight: 600,
          }}
        >
          <CheckCircle2
            size={17}
            style={{
              verticalAlign: "middle",
              marginRight: 8,
            }}
          />
          {sucesso}
        </div>
      )}

      {abaAtual === "usuarios" && (
        <>
          <div className="stats">
            <div className="stat-card">
              <div className="stat-icon green">
                <Users />
              </div>
              <span>Total de usuários</span>
              <h2>{usuarios.length}</h2>
              <small>Contas de clientes cadastradas</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon blue">
                <CheckCircle2 />
              </div>
              <span>Usuários ativos</span>
              <h2>{usuariosAtivos}</h2>
              <small>Com acesso liberado</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon yellow">
                <Power />
              </div>
              <span>Usuários inativos</span>
              <h2>{usuariosInativos}</h2>
              <small>Com acesso bloqueado</small>
            </div>
          </div>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Contas cadastradas</h2>
                <p>
                  Consulte e controle o acesso de cada cliente.
                </p>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={carregarUsuarios}
                disabled={carregando || excluindoId !== null}
              >
                <RefreshCw size={16} />
                Atualizar
              </button>
            </div>

            <div className="search-box" style={{ margin: "0 20px 20px" }}>
              <Search size={18} />

              <input
                type="search"
                placeholder="Pesquisar por nome ou e-mail..."
                value={pesquisa}
                onChange={(e) => setPesquisa(e.target.value)}
              />

              {pesquisa && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setPesquisa("")}
                  aria-label="Limpar pesquisa"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>USUÁRIO</th>
                    <th>E-MAIL</th>
                    <th>PLANO</th>
                    <th>INÍCIO DO PLANO</th>
                    <th>FINAL DO PLANO</th>
                    <th>SITUAÇÃO</th>
                    <th>AÇÃO</th>
                  </tr>
                </thead>

                <tbody>
                  {carregando ? (
                    <tr>
                      <td colSpan="7">
                        <div className="orcamentos-vazio">
                          Carregando usuários...
                        </div>
                      </td>
                    </tr>
                  ) : usuariosFiltrados.length > 0 ? (
                    usuariosFiltrados.map((usuario) => {
                      const ativo = Number(usuario.ativo) === 1;
                      const excluindo = excluindoId === usuario.id;

                      return (
                        <tr key={usuario.id}>
                          <td>
                            <strong>{usuario.nome}</strong>
                          </td>

                          <td>{usuario.email}</td>

                          <td>
                            <strong>{usuario.plano || "—"}</strong>
                          </td>

                          <td>{formatarDataPlano(usuario.inicio_plano)}</td>

                          <td>{formatarDataPlano(usuario.fim_plano)}</td>

                          <td>
                            <span
                              className={`status ${
                                ativo ? "aprovado" : "pendente"
                              }`}
                            >
                              {ativo ? "Ativo" : "Inativo"}
                            </span>
                          </td>

                          <td>
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                className={
                                  ativo
                                    ? "secondary-button"
                                    : "primary-button"
                                }
                                onClick={() => alterarStatus(usuario)}
                                disabled={excluindo || excluindoId !== null}
                              >
                                <Power size={16} />
                                {ativo ? "Desativar" : "Ativar"}
                              </button>

                              <button
                                type="button"
                                onClick={() => excluirUsuario(usuario)}
                                disabled={excluindo || excluindoId !== null}
                                title="Excluir cliente definitivamente"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 6,
                                  padding: "9px 12px",
                                  borderRadius: 8,
                                  border: "1px solid #dc2626",
                                  background: "rgba(220, 38, 38, 0.08)",
                                  color: "#dc2626",
                                  cursor: excluindoId !== null ? "not-allowed" : "pointer",
                                  opacity: excluindoId !== null ? 0.6 : 1,
                                  fontWeight: 600,
                                }}
                              >
                                <Trash2 size={16} />
                                {excluindo ? "Excluindo..." : "Excluir"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7">
                        <div className="orcamentos-vazio">
                          <Users size={30} />
                          <strong>Nenhum usuário encontrado</strong>
                          <span>
                            {pesquisa
                              ? "Tente pesquisar por outro nome ou e-mail."
                              : "As contas de clientes cadastradas aparecerão aqui."}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {abaAtual === "planos" && (
        <>
          <div className="stats">
            <div className="stat-card">
              <div className="stat-icon green">
                <CreditCard />
              </div>
              <span>Total de planos</span>
              <h2>{planos.length}</h2>
              <small>Planos cadastrados no sistema</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon blue">
                <CheckCircle2 />
              </div>
              <span>Planos ativos</span>
              <h2>{planosAtivos.length}</h2>
              <small>Disponíveis para contratação</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon yellow">
                <Power />
              </div>
              <span>Planos inativos</span>
              <h2>{planos.length - planosAtivos.length}</h2>
              <small>Indisponíveis para novas contas</small>
            </div>
          </div>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Gerenciar planos</h2>
                <p>
                  Consulte e altere os valores dos planos oferecidos.
                </p>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={carregarPlanos}
                disabled={carregandoPlanos}
              >
                <RefreshCw size={16} />
                Atualizar
              </button>
            </div>

            {carregandoPlanos ? (
              <div className="orcamentos-vazio">
                Carregando planos...
              </div>
            ) : planos.length === 0 ? (
              <div className="orcamentos-vazio">
                <CreditCard size={30} />
                <strong>Nenhum plano encontrado</strong>
                <span>Os planos cadastrados aparecerão aqui.</span>
              </div>
            ) : (
              <div style={{ padding: 20 }}>
                {planos.map((plano) => {
                  const ativo = Number(plano.ativo) === 1;
                  const editando = planoEmEdicao === plano.id;

                  return (
                    <div
                      key={plano.id}
                      style={{
                        border: "1px solid var(--border-color, #e5e7eb)",
                        borderRadius: 12,
                        padding: 18,
                        marginBottom: 16,
                      }}
                    >
                      {!editando ? (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 16,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 9,
                                marginBottom: 8,
                              }}
                            >
                              <Tag size={18} />
                              <strong style={{ fontSize: 17 }}>
                                {plano.nome}
                              </strong>
                            </div>

                            <div
                              style={{
                                color: "var(--text-muted, #888)",
                                fontSize: 13,
                                marginBottom: 8,
                              }}
                            >
                              {nomePeriodicidade(plano.periodicidade)}
                              {" · "}
                              Código: {plano.codigo}
                            </div>

                            <div
                              style={{
                                fontSize: 22,
                                fontWeight: 700,
                                marginBottom: 8,
                              }}
                            >
                              {formatarValor(plano.valor)}
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 400,
                                  marginLeft: 6,
                                  color: "var(--text-muted, #888)",
                                }}
                              >
                                {descricaoPlano(plano)}
                              </span>
                            </div>

                            <span
                              className={`status ${
                                ativo ? "aprovado" : "pendente"
                              }`}
                            >
                              {ativo ? "Ativo" : "Inativo"}
                            </span>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => iniciarEdicaoPlano(plano)}
                            >
                              <Pencil size={16} />
                              Editar
                            </button>

                            <button
                              type="button"
                              className={
                                ativo
                                  ? "secondary-button"
                                  : "primary-button"
                              }
                              onClick={() => alterarStatusPlano(plano)}
                            >
                              <Power size={16} />
                              {ativo ? "Desativar" : "Ativar"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={(e) => salvarPlano(e, plano)}>
                          <h3 style={{ marginTop: 0, marginBottom: 18 }}>
                            <Pencil
                              size={18}
                              style={{
                                verticalAlign: "middle",
                                marginRight: 7,
                              }}
                            />
                            Editar plano
                          </h3>

                          <div className="login-field">
                            <label>Nome do plano</label>
                            <input
                              type="text"
                              value={formularioPlano.nome}
                              onChange={(e) =>
                                setFormularioPlano((anterior) => ({
                                  ...anterior,
                                  nome: e.target.value,
                                }))
                              }
                              required
                            />
                          </div>

                          <div className="login-field">
                            <label>Periodicidade</label>
                            <select
                              value={formularioPlano.periodicidade}
                              onChange={(e) => {
                                const periodicidade = e.target.value;

                                setFormularioPlano((anterior) => ({
                                  ...anterior,
                                  periodicidade,
                                  valor:
                                    periodicidade === "gratuito"
                                      ? "0"
                                      : anterior.valor === "0"
                                        ? ""
                                        : anterior.valor,
                                }));
                              }}
                            >
                              <option value="gratuito">Gratuito</option>
                              <option value="mensal">Mensal</option>
                              <option value="anual">Anual</option>
                            </select>
                          </div>

                          <div className="login-field">
                            <label>Valor do plano (R$)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={formularioPlano.valor}
                              onChange={(e) =>
                                setFormularioPlano((anterior) => ({
                                  ...anterior,
                                  valor: e.target.value,
                                }))
                              }
                              disabled={
                                formularioPlano.periodicidade === "gratuito"
                              }
                              required
                            />
                            {formularioPlano.periodicidade === "gratuito" && (
                              <small>
                                O plano gratuito sempre terá valor de R$ 0,00.
                              </small>
                            )}
                          </div>

                          <div
                            className="orcamento-acoes"
                            style={{ marginTop: 18 }}
                          >
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={cancelarEdicaoPlano}
                              disabled={salvando}
                            >
                              <X size={16} />
                              Cancelar
                            </button>

                            <button
                              type="submit"
                              className="primary-button"
                              disabled={salvando}
                            >
                              <Save size={16} />
                              {salvando ? "Salvando..." : "Salvar alterações"}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {abaAtual === "pagamentos" && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Gerenciar pagamentos</h2>
              <p>
                Confira os pagamentos dos clientes e confirme os recebimentos.
              </p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={carregarPagamentos}
              disabled={
                carregandoPagamentos || confirmandoPagamento !== null
              }
            >
              <RefreshCw size={16} />
              Atualizar
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>CLIENTE</th>
                  <th>PLANO</th>
                  <th>VALOR</th>
                  <th>FORMA DE PAGAMENTO</th>
                  <th>SITUAÇÃO</th>
                  <th>AÇÃO</th>
                </tr>
              </thead>

              <tbody>
                {carregandoPagamentos ? (
                  <tr>
                    <td colSpan="6">
                      <div className="orcamentos-vazio">
                        Carregando pagamentos...
                      </div>
                    </td>
                  </tr>
                ) : pagamentos.length > 0 ? (
                  pagamentos.map((pagamento) => {
                    const pendente = pagamento.status === "pendente";
                    const confirmando =
                      confirmandoPagamento === pagamento.id;

                    return (
                      <tr key={pagamento.id}>
                        <td>
                          <strong>{pagamento.cliente}</strong>
                          <br />
                          <small>{pagamento.email}</small>
                        </td>

                        <td>{pagamento.plano || "—"}</td>

                        <td>
                          <strong>{formatarValor(pagamento.valor)}</strong>
                        </td>

                        <td>
                          {pagamento.forma_pagamento || "Não informado"}
                        </td>

                        <td>
                          <span
                            className={`status ${
                              pagamento.status === "aprovado"
                                ? "aprovado"
                                : "pendente"
                            }`}
                          >
                            {pagamento.status === "aprovado"
                              ? "Aprovado"
                              : pagamento.status === "pendente"
                                ? "Pendente"
                                : pagamento.status}
                          </span>
                        </td>

                        <td>
                          {pendente ? (
                            <button
                              type="button"
                              className="primary-button"
                              onClick={() => confirmarPagamento(pagamento)}
                              disabled={confirmandoPagamento !== null}
                            >
                              <CheckCircle2 size={16} />
                              {confirmando
                                ? "Confirmando..."
                                : "Confirmar pagamento"}
                            </button>
                          ) : (
                            <span
                              style={{ color: "var(--text-muted, #888)" }}
                            >
                              Sem ação
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6">
                      <div className="orcamentos-vazio">
                        <CreditCard size={30} />
                        <strong>Nenhum pagamento encontrado</strong>
                        <span>
                          Os pagamentos dos clientes aparecerão aqui.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modalAberto && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !salvando) {
              setModalAberto(false);
            }
          }}
        >
          <div className="modal-card">
            <div className="panel-header">
              <div>
                <h2>
                  <UserPlus
                    size={20}
                    style={{
                      verticalAlign: "middle",
                      marginRight: 8,
                    }}
                  />
                  Criar novo usuário
                </h2>

                <p>Cadastre uma nova conta de cliente.</p>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() => setModalAberto(false)}
                aria-label="Fechar"
                disabled={salvando}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={criarUsuario}>
              <div className="login-field">
                <label>Nome completo</label>

                <input
                  type="text"
                  value={formulario.nome}
                  onChange={(e) =>
                    atualizarCampo("nome", e.target.value)
                  }
                  placeholder="Nome do cliente"
                  required
                />
              </div>

              <div className="login-field">
                <label>E-mail</label>

                <input
                  type="email"
                  value={formulario.email}
                  onChange={(e) =>
                    atualizarCampo("email", e.target.value)
                  }
                  placeholder="cliente@email.com"
                  required
                />
              </div>

              <div className="login-field">
                <label>Senha inicial</label>

                <input
                  type="password"
                  value={formulario.senha}
                  onChange={(e) =>
                    atualizarCampo("senha", e.target.value)
                  }
                  placeholder="Mínimo de 8 caracteres"
                  minLength={8}
                  required
                />
              </div>

              <div className="login-field">
                <label>Plano do cliente</label>

                <select
                  value={formulario.plano_id}
                  onChange={(e) =>
                    atualizarCampo("plano_id", e.target.value)
                  }
                  required
                  disabled={
                    carregandoPlanos || planosAtivos.length === 0
                  }
                >
                  <option value="">
                    {carregandoPlanos
                      ? "Carregando planos..."
                      : planosAtivos.length === 0
                        ? "Nenhum plano disponível"
                        : "Selecione um plano"}
                  </option>

                  {planosAtivos.map((plano) => (
                    <option key={plano.id} value={plano.id}>
                      {plano.nome} — {formatarValor(plano.valor)}{" "}
                      {descricaoPlano(plano)}
                    </option>
                  ))}
                </select>
              </div>

              <p
                style={{
                  color: "var(--text-muted, #888)",
                  fontSize: 13,
                }}
              >
                O plano gratuito será ativado automaticamente. Planos
                pagos serão cadastrados com pagamento pendente.
              </p>

              <div className="orcamento-acoes">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setModalAberto(false)}
                  disabled={salvando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    salvando ||
                    carregandoPlanos ||
                    planosAtivos.length === 0
                  }
                >
                  <UserPlus size={17} />
                  {salvando ? "Criando..." : "Criar usuário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
