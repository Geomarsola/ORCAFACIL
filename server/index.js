
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import session from "express-session";
import MySQLStoreFactory from "express-mysql-session";
import pool from "./db.js";

dotenv.config();

if (!process.env.SESSION_SECRET) {
  throw new Error("Configure SESSION_SECRET no arquivo .env");
}

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// SESSÕES NO MYSQL
// ========================================

const MySQLStore = MySQLStoreFactory(session);

const sessionStore = new MySQLStore({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "orcafacil",
  clearExpired: true,
  checkExpirationInterval: 900000,
  expiration: 1000 * 60 * 60 * 24 * 7,
  createDatabaseTable: true,
});

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
    ) {
      return callback(null, true);
    }

    callback(new Error("Origem não permitida pelo CORS"));
  },
  credentials: true,
}));

app.use(express.json());

app.use(session({
  name: "orcafacil_session",
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));

// ========================================
// AUTENTICAÇÃO E PERMISSÕES
// ========================================

async function exigirAutenticacao(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      sucesso: false,
      autenticado: false,
      mensagem: "Você precisa entrar no sistema.",
    });
  }

  try {
    const usuarioId = req.session.userId;

    const [usuarios] = await pool.query(
      `SELECT id, perfil
       FROM usuarios
       WHERE id = ?
         AND ativo = 1
         AND excluido_em IS NULL
       LIMIT 1`,
      [usuarioId]
    );

    if (!usuarios.length) {
      return req.session.destroy(() => {
        res.clearCookie("orcafacil_session");

        res.status(401).json({
          sucesso: false,
          autenticado: false,
          mensagem: "Sua conta está bloqueada ou foi excluída.",
        });
      });
    }

    // Administrador não depende de assinatura.
    if (usuarios[0].perfil === "admin") {
      return next();
    }

    // Busca a assinatura mais recente do cliente.
    const [assinaturas] = await pool.query(
      `SELECT
        a.id,
        a.status,
        a.proxima_cobranca_em,
        p.periodicidade
       FROM assinaturas a
       INNER JOIN planos p ON p.id = a.plano_id
       WHERE a.usuario_id = ?
       ORDER BY a.id DESC
       LIMIT 1`,
      [usuarioId]
    );

    if (!assinaturas.length) {
      return res.status(403).json({
        sucesso: false,
        assinatura_bloqueada: true,
        mensagem: "Sua conta não possui uma assinatura vinculada.",
      });
    }

    const assinatura = assinaturas[0];

    // Plano gratuito não vence.
    if (assinatura.periodicidade === "gratuito") {
      if (assinatura.status !== "ativa") {
        return res.status(403).json({
          sucesso: false,
          assinatura_bloqueada: true,
          mensagem: "Sua assinatura não está ativa.",
        });
      }

      return next();
    }

    // Verifica se a assinatura paga está vencida
    const dataAtual = new Date();

    if (
      assinatura.status === "ativa" &&
      (
        !assinatura.proxima_cobranca_em ||
        new Date(assinatura.proxima_cobranca_em) <= dataAtual
      )
    ) {
      const novoStatus = assinatura.proxima_cobranca_em
        ? "vencida"
        : "inadimplente";

      await pool.query(
        `UPDATE assinaturas
         SET status = ?
         WHERE id = ?
           AND status = 'ativa'`,
        [novoStatus, assinatura.id]
      );

      assinatura.status = novoStatus;
    }

    // Somente assinaturas ativas podem acessar o sistema.
    if (assinatura.status !== "ativa") {
      return res.status(403).json({
        sucesso: false,
        assinatura_bloqueada: true,
        status_assinatura: assinatura.status,
        mensagem:
          assinatura.status === "vencida"
            ? "Sua assinatura venceu. Entre em contato com o administrador para renovar seu acesso."
            : "Sua assinatura não está ativa. Entre em contato com o administrador.",
      });
    }

    next();
  } catch (erro) {
    console.error("Erro ao validar autenticação e assinatura:", erro);

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao verificar sua autenticação.",
    });
  }
}

function exigirAdmin(req, res, next) {
  if (!req.session || req.session.userPerfil !== "admin") {
    return res.status(403).json({
      sucesso: false,
      mensagem: "Acesso permitido somente ao administrador.",
    });
  }

  next();
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function dataValidade(dataEmissao, dias) {
  const data = new Date(`${dataEmissao}T12:00:00`);
  data.setDate(data.getDate() + Number(dias || 7));

  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
}

function calcularDiasValidade(dataEmissao, validade) {
  if (!validade) return 7;

  const inicio = new Date(
    `${String(dataEmissao).slice(0, 10)}T12:00:00`
  );

  const fim = new Date(
    `${String(validade).slice(0, 10)}T12:00:00`
  );

  const diferenca = Math.round(
    (fim - inicio) / (1000 * 60 * 60 * 24)
  );

  return diferenca > 0 ? diferenca : 7;
}

function formatarOrcamento(orcamento, itens) {
  return {
    id: orcamento.id,
    numero: `#${String(orcamento.id).padStart(4, "0")}`,
    clienteId: orcamento.cliente_id,
    cliente: orcamento.cliente,
    telefoneCliente: orcamento.telefone,
    emailCliente: orcamento.email,
    dataEmissao: String(orcamento.data_emissao).slice(0, 10),
    validade: calcularDiasValidade(
      orcamento.data_emissao,
      orcamento.validade
    ),
    itens: itens.map((item) => ({
      id: item.id,
      descricao: item.descricao,
      quantidade: Number(item.quantidade),
      valor: Number(item.valor_unitario),
    })),
    subtotal: itens.reduce(
      (total, item) =>
        total +
        Number(item.quantidade) * Number(item.valor_unitario),
      0
    ),
    desconto: Number(orcamento.desconto || 0),
    total: Number(orcamento.total || 0),
    formaPagamento: orcamento.forma_pagamento || "",
    observacoes: orcamento.observacoes || "",
    status: orcamento.status || "Pendente",
    statusRecebimento: orcamento.status_recebimento || "Aguardando",
    valorRecebido: Number(orcamento.valor_recebido || 0),
    dataRecebimento: orcamento.data_recebimento
      ? String(orcamento.data_recebimento).slice(0, 10)
      : null,
  };
}

async function inserirItens(connection, orcamentoId, itens) {
  for (const item of itens) {
    const descricao = String(item.descricao || "").trim();
    const quantidade = Number(item.quantidade || 0);
    const valor = Number(item.valor ?? item.valor_unitario ?? 0);

    if (
      !descricao ||
      quantidade <= 0 ||
      !Number.isFinite(valor) ||
      valor < 0
    ) {
      throw new Error(
        "Um dos itens do orçamento possui dados inválidos."
      );
    }

    await connection.query(
      `INSERT INTO orcamento_itens
        (orcamento_id, descricao, quantidade, valor_unitario, subtotal)
       VALUES (?, ?, ?, ?, ?)`,
      [
        orcamentoId,
        descricao,
        quantidade,
        valor,
        quantidade * valor,
      ]
    );
  }
}

// ========================================
// ROTAS PÚBLICAS
// ========================================

app.get("/", (req, res) => {
  res.json({
    mensagem: "API OrçaFácil funcionando!",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    sucesso: true,
    mensagem: "Servidor OrçaFácil funcionando!",
  });
});

app.get("/api/teste-banco", async (req, res) => {
  try {
    const [resultado] = await pool.query(
      "SELECT DATABASE() AS banco, NOW() AS horario"
    );

    res.json({
      sucesso: true,
      mensagem: "Conexão com MySQL realizada!",
      dados: resultado[0],
    });
  } catch (erro) {
    console.error("Erro ao consultar MySQL:", erro);

    res.status(500).json({
      sucesso: false,
      mensagem: "Não foi possível conectar ao banco.",
    });
  }
});

// ========================================
// LOGIN
// ========================================

app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    const senha = String(req.body.senha || "");

    if (!email || !senha) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe o e-mail e a senha.",
      });
    }

    const [usuarios] = await pool.query(
      `SELECT id, nome, email, senha_hash, ativo, perfil
       FROM usuarios
       WHERE email = ?
         AND excluido_em IS NULL
       LIMIT 1`,
      [email]
    );

    if (
      usuarios.length === 0 ||
      !usuarios[0].ativo
    ) {
      return res.status(401).json({
        sucesso: false,
        mensagem: "E-mail ou senha inválidos.",
      });
    }

    const usuario = usuarios[0];

    const senhaValida = await bcrypt.compare(
      senha,
      usuario.senha_hash
    );

    if (!senhaValida) {
      return res.status(401).json({
        sucesso: false,
        mensagem: "E-mail ou senha inválidos.",
      });
    }

    req.session.regenerate((erro) => {
      if (erro) {
        console.error("Erro ao criar sessão:", erro);

        return res.status(500).json({
          sucesso: false,
          mensagem: "Não foi possível iniciar sua sessão.",
        });
      }

      req.session.userId = usuario.id;
      req.session.userName = usuario.nome;
      req.session.userEmail = usuario.email;
      req.session.userPerfil = usuario.perfil;

      req.session.save((erroSalvar) => {
        if (erroSalvar) {
          console.error("Erro ao salvar sessão:", erroSalvar);

          return res.status(500).json({
            sucesso: false,
            mensagem: "Não foi possível salvar sua sessão.",
          });
        }

        res.json({
          sucesso: true,
          mensagem: "Login realizado com sucesso!",
          usuario: {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil,
          },
        });
      });
    });
  } catch (erro) {
    console.error("Erro no login:", erro);

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao realizar login.",
    });
  }
});

// ========================================
// VERIFICAR SESSÃO
// ========================================

app.get("/api/me", async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({
      autenticado: false,
      usuario: null,
    });
  }

  try {
    const usuarioId = req.session.userId;

    const [assinaturas] = await pool.query(
      `SELECT
        p.id AS plano_id,
        p.nome AS plano,
        p.periodicidade,
        p.valor,
        a.status AS status_assinatura,
        a.proxima_cobranca_em
       FROM assinaturas a
       INNER JOIN planos p ON p.id = a.plano_id
       WHERE a.usuario_id = ?
       ORDER BY a.id DESC
       LIMIT 1`,
      [usuarioId]
    );

    const assinatura = assinaturas[0] || null;

    res.json({
      autenticado: true,
      usuario: {
        id: usuarioId,
        nome: req.session.userName,
        email: req.session.userEmail,
        perfil: req.session.userPerfil,

        plano: assinatura?.plano || null,
        plano_id: assinatura?.plano_id || null,
        periodicidade: assinatura?.periodicidade || null,
        valor_plano: assinatura
          ? Number(assinatura.valor)
          : null,
        status_assinatura:
          assinatura?.status_assinatura || null,
        proxima_cobranca_em:
          assinatura?.proxima_cobranca_em || null,
      },
    });
  } catch (erro) {
    console.error("Erro ao verificar sessão e plano:", erro);

    res.status(500).json({
      autenticado: false,
      usuario: null,
      mensagem: "Erro ao carregar os dados da sua conta.",
    });
  }
});

// ========================================
// SAIR DO SISTEMA
// ========================================

app.post("/api/logout", (req, res) => {
  if (!req.session) {
    return res.json({
      sucesso: true,
      mensagem: "Você saiu do sistema.",
    });
  }

  req.session.destroy((erro) => {
    if (erro) {
      console.error("Erro ao encerrar sessão:", erro);

      return res.status(500).json({
        sucesso: false,
        mensagem: "Não foi possível encerrar a sessão.",
      });
    }

    res.clearCookie("orcafacil_session");

    res.json({
      sucesso: true,
      mensagem: "Você saiu do sistema.",
    });
  });
});

// ========================================
// PROTEGER TODAS AS ROTAS PRIVADAS
// ========================================

app.use("/api", exigirAutenticacao);

// ========================================
// PROTEGER ROTAS ADMINISTRATIVAS
// ========================================

app.use("/api/admin", exigirAdmin);

// ========================================
// ADMINISTRAÇÃO - RESUMO
// ========================================

app.get("/api/admin/resumo", async (req, res) => {
  try {
    const [[usuarios]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN ativo = 1 THEN 1 ELSE 0 END) AS ativos,
        SUM(CASE WHEN ativo = 0 THEN 1 ELSE 0 END) AS bloqueados
      FROM usuarios
      WHERE perfil = 'cliente'
         AND excluido_em IS NULL
    `);

    const [[assinaturas]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'ativa') AS ativas,
        SUM(status = 'pendente') AS pendentes,
        SUM(status = 'inadimplente') AS inadimplentes
      FROM assinaturas
    `);

    const [[faturamento]] = await pool.query(`
      SELECT COALESCE(SUM(valor), 0) AS total
      FROM pagamentos
      WHERE status = 'aprovado'
    `);

    res.json({
      sucesso: true,
      resumo: {
        clientes: {
          total: Number(usuarios.total || 0),
          ativos: Number(usuarios.ativos || 0),
          bloqueados: Number(usuarios.bloqueados || 0),
        },
        assinaturas: {
          total: Number(assinaturas.total || 0),
          ativas: Number(assinaturas.ativas || 0),
          pendentes: Number(assinaturas.pendentes || 0),
          inadimplentes: Number(assinaturas.inadimplentes || 0),
        },
        faturamento: Number(faturamento.total || 0),
      },
    });
  } catch (erro) {
    console.error("Erro no resumo administrativo:", erro);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao carregar o resumo administrativo.",
    });
  }
});

// ========================================
// ADMINISTRAÇÃO - CLIENTES
// ========================================

app.get("/api/admin/clientes", async (req, res) => {
  try {
    const [clientes] = await pool.query(`
      SELECT
        u.id,
        u.nome,
        u.email,
        u.ativo,
        u.criado_em,
        p.nome AS plano,
        a.status AS status_assinatura,
        a.inicio_em AS inicio_plano,
        a.proxima_cobranca_em AS fim_plano
      FROM usuarios u
      LEFT JOIN assinaturas a
        ON a.id = (
          SELECT a2.id
          FROM assinaturas a2
          WHERE a2.usuario_id = u.id
          ORDER BY a2.id DESC
          LIMIT 1
        )
      LEFT JOIN planos p
        ON p.id = a.plano_id
      WHERE u.perfil = 'cliente'
        AND u.excluido_em IS NULL
      ORDER BY u.id DESC
    `);

    res.json({
      sucesso: true,
      clientes: clientes.map((cliente) => ({
        ...cliente,
        ativo: Number(cliente.ativo),
      })),
    });
  } catch (erro) {
    console.error("Erro ao listar clientes:", erro);

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao buscar clientes.",
    });
  }
});

app.post("/api/admin/clientes", async (req, res) => {
  let connection;

  try {
    const nome = String(req.body.nome || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const senha = String(req.body.senha || "");
    const planoId = Number(req.body.plano_id);

    if (!nome || !email || !senha || !Number.isInteger(planoId) || planoId <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe nome, e-mail, senha e plano.",
      });
    }

    if (nome.length > 150 || email.length > 150) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Nome ou e-mail muito longo.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe um e-mail válido.",
      });
    }

    if (senha.length < 8) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "A senha deve ter pelo menos 8 caracteres.",
      });
    }

    const senhaHash = await bcrypt.hash(senha, 12);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [planos] = await connection.query(
      `SELECT id, nome, periodicidade, valor
       FROM planos
       WHERE id = ? AND ativo = 1`,
      [planoId]
    );

    if (!planos.length) {
      await connection.rollback();

      return res.status(404).json({
        sucesso: false,
        mensagem: "Plano não encontrado ou inativo.",
      });
    }

    const plano = planos[0];
    const gratuito = plano.periodicidade === "gratuito";
    const statusAssinatura = gratuito ? "ativa" : "pendente";

    const [resultadoUsuario] = await connection.query(
      `INSERT INTO usuarios
       (nome, email, senha_hash, ativo, perfil)
       VALUES (?, ?, ?, 1, 'cliente')`,
      [nome, email, senhaHash]
    );

    const usuarioId = resultadoUsuario.insertId;

    const [resultadoAssinatura] = await connection.query(
      `INSERT INTO assinaturas (
        usuario_id,
        plano_id,
        gateway,
        forma_contratacao,
        status,
        inicio_em,
        proxima_cobranca_em
      )
      VALUES (
        ?, ?, 'manual', 'manual', ?,
        CASE WHEN ? = 1 THEN NOW() ELSE NULL END,
        NULL
      )`,
      [
        usuarioId,
        planoId,
        statusAssinatura,
        gratuito ? 1 : 0,
      ]
    );

    if (!gratuito) {
      await connection.query(
        `INSERT INTO pagamentos (
          assinatura_id,
          usuario_id,
          gateway,
          forma_pagamento,
          valor,
          moeda,
          status,
          observacao
        )
        VALUES (?, ?, 'manual', 'outro', ?, 'BRL', 'pendente', ?)`,
        [
          resultadoAssinatura.insertId,
          usuarioId,
          Number(plano.valor),
          "Pagamento pendente do cadastro administrativo.",
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      sucesso: true,
      mensagem: "Cliente cadastrado e plano vinculado com sucesso!",
      cliente: {
        id: usuarioId,
        nome,
        email,
        ativo: 1,
        perfil: "cliente",
      },
      assinatura: {
        id: resultadoAssinatura.insertId,
        plano_id: planoId,
        plano: plano.nome,
        status: statusAssinatura,
      },
    });
  } catch (erro) {
    if (connection) await connection.rollback();

    console.error("Erro ao cadastrar cliente e vincular plano:", erro);

    if (erro.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Este e-mail já está cadastrado.",
      });
    }

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao cadastrar cliente e vincular plano.",
    });
  } finally {
    if (connection) connection.release();
  }
});

app.patch("/api/admin/clientes/:id/status", async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    const ativo = req.body.ativo;

    if (!Number.isInteger(clienteId) || clienteId <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Identificador inválido.",
      });
    }

    if (![0, 1, false, true].includes(ativo)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe o status do cliente.",
      });
    }

    const [resultado] = await pool.query(
      `UPDATE usuarios
       SET ativo = ?
       WHERE id = ?
         AND perfil = 'cliente'
         AND excluido_em IS NULL`,
      [ativo ? 1 : 0, clienteId]
    );

    if (!resultado.affectedRows) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Cliente não encontrado.",
      });
    }

    res.json({
      sucesso: true,
      mensagem: ativo
        ? "Cliente reativado com sucesso!"
        : "Cliente bloqueado com sucesso!",
    });
  } catch (erro) {
    console.error("Erro ao alterar cliente:", erro);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao alterar cliente.",
    });
  }
});

// ========================================
// ADMINISTRAÇÃO - EXCLUIR CLIENTE
// ========================================

app.delete("/api/admin/clientes/:id", async (req, res) => {
  try {
    const clienteId = Number(req.params.id);

    if (!Number.isInteger(clienteId) || clienteId <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Identificador do cliente inválido.",
      });
    }

    const [resultado] = await pool.query(
      `UPDATE usuarios
       SET ativo = 0,
           excluido_em = NOW()
       WHERE id = ?
         AND perfil = 'cliente'
         AND excluido_em IS NULL`,
      [clienteId]
    );

    if (!resultado.affectedRows) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Cliente não encontrado ou já excluído.",
      });
    }

    res.json({
      sucesso: true,
      mensagem: "Cliente excluído com sucesso! O histórico financeiro foi preservado.",
    });

  } catch (erro) {
    console.error("Erro ao excluir cliente administrativo:", erro);

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao excluir cliente.",
    });
  }
});

// ========================================
// ADMINISTRAÇÃO - PLANOS
// ========================================

app.get("/api/admin/planos", async (req, res) => {
  try {
    const [planos] = await pool.query(`
      SELECT id, codigo, nome, periodicidade, valor,
             moeda, ativo, criado_em, atualizado_em
      FROM planos
      ORDER BY id ASC
    `);

    res.json({
      sucesso: true,
      planos: planos.map((plano) => ({
        ...plano,
        valor: Number(plano.valor),
        ativo: Number(plano.ativo),
      })),
    });
  } catch (erro) {
    console.error("Erro ao listar planos:", erro);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao buscar planos.",
    });
  }
});

// CADASTRAR PLANO

app.post("/api/admin/planos", async (req, res) => {
  try {
    const codigo = String(req.body.codigo || "").trim().toLowerCase();
    const nome = String(req.body.nome || "").trim();
    const periodicidade = String(req.body.periodicidade || "");
    const valor = Number(req.body.valor);

    if (!codigo || !nome || !["gratuito", "mensal", "anual"].includes(periodicidade)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe código, nome e periodicidade válidos.",
      });
    }

    if (!Number.isFinite(valor) || valor < 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe um valor válido.",
      });
    }

    if ((periodicidade === "gratuito" && valor !== 0) ||
        (periodicidade !== "gratuito" && valor <= 0)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "O valor não corresponde à periodicidade do plano.",
      });
    }

    const [resultado] = await pool.query(
      `INSERT INTO planos
       (codigo, nome, periodicidade, valor, moeda, ativo)
       VALUES (?, ?, ?, ?, 'BRL', 1)`,
      [codigo, nome, periodicidade, valor]
    );

    res.status(201).json({
      sucesso: true,
      mensagem: "Plano cadastrado com sucesso!",
      id: resultado.insertId,
    });
  } catch (erro) {
    console.error("Erro ao cadastrar plano:", erro);

    if (erro.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Já existe um plano com esse código.",
      });
    }

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao cadastrar plano.",
    });
  }
});

// EDITAR PLANO

app.put("/api/admin/planos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const nome = String(req.body.nome || "").trim();
    const periodicidade = String(req.body.periodicidade || "");
    const valor = Number(req.body.valor);

    if (!Number.isInteger(id) || id <= 0 || !nome) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe um plano e um nome válidos.",
      });
    }

    if (!["gratuito", "mensal", "anual"].includes(periodicidade) ||
        !Number.isFinite(valor) || valor < 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Dados do plano inválidos.",
      });
    }

    if ((periodicidade === "gratuito" && valor !== 0) ||
        (periodicidade !== "gratuito" && valor <= 0)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "O valor não corresponde à periodicidade.",
      });
    }

    const [resultado] = await pool.query(
      `UPDATE planos
       SET nome = ?, periodicidade = ?, valor = ?
       WHERE id = ?`,
      [nome, periodicidade, valor, id]
    );

    if (!resultado.affectedRows) {
      const [existentes] = await pool.query(
        "SELECT id FROM planos WHERE id = ?",
        [id]
      );

      if (!existentes.length) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Plano não encontrado.",
        });
      }
    }

    res.json({
      sucesso: true,
      mensagem: "Plano atualizado com sucesso!",
    });
  } catch (erro) {
    console.error("Erro ao editar plano:", erro);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao editar plano.",
    });
  }
});

// ATIVAR / DESATIVAR PLANO

app.patch("/api/admin/planos/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ativo = req.body.ativo;

    if (!Number.isInteger(id) || id <= 0 ||
        ![0, 1, false, true].includes(ativo)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Dados inválidos.",
      });
    }

    const [resultado] = await pool.query(
      "UPDATE planos SET ativo = ? WHERE id = ?",
      [ativo ? 1 : 0, id]
    );

    if (!resultado.affectedRows) {
      const [existentes] = await pool.query(
        "SELECT id FROM planos WHERE id = ?",
        [id]
      );

      if (!existentes.length) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Plano não encontrado.",
        });
      }
    }

    res.json({
      sucesso: true,
      mensagem: ativo ? "Plano ativado!" : "Plano desativado!",
    });
  } catch (erro) {
    console.error("Erro ao alterar plano:", erro);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao alterar plano.",
    });
  }
});

// ========================================
// ADMINISTRAÇÃO - ASSINATURAS
// ========================================

app.get("/api/admin/assinaturas", async (req, res) => {
  try {
    const [assinaturas] = await pool.query(`
      SELECT
        a.id,
        a.usuario_id,
        a.plano_id,
        u.nome AS cliente,
        u.email,
        p.nome AS plano,
        p.periodicidade,
        p.valor,
        a.gateway,
        a.forma_contratacao,
        a.status,
        a.inicio_em,
        a.proxima_cobranca_em,
        a.fim_em,
        a.cancelar_no_vencimento
      FROM assinaturas a
      INNER JOIN usuarios u ON u.id = a.usuario_id
      INNER JOIN planos p ON p.id = a.plano_id
      ORDER BY a.id DESC
    `);

    res.json({
      sucesso: true,
      assinaturas,
    });
  } catch (erro) {
    console.error("Erro ao listar assinaturas:", erro);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao buscar assinaturas.",
    });
  }
});

// VINCULAR PLANO A CLIENTE

app.post("/api/admin/assinaturas", async (req, res) => {
  let connection;

  try {
    const usuarioId = Number(req.body.usuario_id);
    const planoId = Number(req.body.plano_id);
    const formaPagamento = String(req.body.forma_pagamento || "outro");
    const pagamentoStatus = String(req.body.pagamento_status || "pendente");
    const observacao = String(req.body.observacao || "").trim();

    const formas = [
      "pix", "cartao_credito", "cartao_debito", "boleto",
      "dinheiro", "transferencia", "mercadopago", "outro",
    ];

    if (!Number.isInteger(usuarioId) || usuarioId <= 0 ||
        !Number.isInteger(planoId) || planoId <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Selecione um cliente e um plano válidos.",
      });
    }

    if (!formas.includes(formaPagamento)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Forma de pagamento inválida.",
      });
    }

    if (!["pendente", "aprovado"].includes(pagamentoStatus)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Situação do pagamento inválida.",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [usuarios] = await connection.query(
      `SELECT id FROM usuarios
       WHERE id = ? AND perfil = 'cliente'`,
      [usuarioId]
    );

    if (!usuarios.length) {
      await connection.rollback();
      return res.status(404).json({
        sucesso: false,
        mensagem: "Cliente não encontrado.",
      });
    }

    const [planos] = await connection.query(
      `SELECT id, nome, periodicidade, valor
       FROM planos
       WHERE id = ? AND ativo = 1`,
      [planoId]
    );

    if (!planos.length) {
      await connection.rollback();
      return res.status(404).json({
        sucesso: false,
        mensagem: "Plano não encontrado ou inativo.",
      });
    }

    const plano = planos[0];
    const valor = Number(plano.valor);
    const gratuito = plano.periodicidade === "gratuito";

    const inicio = new Date();
    let proximaCobranca = null;

    if (plano.periodicidade === "mensal") {
      proximaCobranca = new Date(inicio);
      proximaCobranca.setMonth(proximaCobranca.getMonth() + 1);
    } else if (plano.periodicidade === "anual") {
      proximaCobranca = new Date(inicio);
      proximaCobranca.setFullYear(proximaCobranca.getFullYear() + 1);
    }

    const dataSQL = (data) =>
      data ? data.toISOString().slice(0, 19).replace("T", " ") : null;

    const assinaturaAtiva = gratuito || pagamentoStatus === "aprovado";

    const [resultado] = await connection.query(
      `INSERT INTO assinaturas (
        usuario_id, plano_id, gateway, forma_contratacao,
        status, inicio_em, proxima_cobranca_em
      )
      VALUES (?, ?, 'manual', 'manual', ?, ?, ?)`,
      [
        usuarioId,
        planoId,
        assinaturaAtiva ? "ativa" : "pendente",
        assinaturaAtiva ? dataSQL(inicio) : null,
        assinaturaAtiva ? dataSQL(proximaCobranca) : null,
      ]
    );

    if (!gratuito) {
      await connection.query(
        `INSERT INTO pagamentos (
          assinatura_id, usuario_id, gateway, forma_pagamento,
          valor, moeda, status, pago_em, observacao
        )
        VALUES (?, ?, 'manual', ?, ?, 'BRL', ?, ?, ?)`,
        [
          resultado.insertId,
          usuarioId,
          formaPagamento,
          valor,
          pagamentoStatus,
          pagamentoStatus === "aprovado" ? dataSQL(inicio) : null,
          observacao || null,
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      sucesso: true,
      mensagem: gratuito
        ? "Plano gratuito vinculado com sucesso!"
        : "Assinatura cadastrada com sucesso!",
      assinatura_id: resultado.insertId,
      status: assinaturaAtiva ? "ativa" : "pendente",
    });
  } catch (erro) {
    if (connection) await connection.rollback();

    console.error("Erro ao vincular plano:", erro);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao vincular plano ao cliente.",
    });
  } finally {
    if (connection) connection.release();
  }
});

// ========================================
// ADMINISTRAÇÃO - PAGAMENTOS
// ========================================

app.get("/api/admin/pagamentos", async (req, res) => {
  try {
    const [pagamentos] = await pool.query(`
      SELECT
        pg.id,
        pg.assinatura_id,
        pg.usuario_id,
        u.nome AS cliente,
        u.email,
        p.nome AS plano,
        pg.gateway,
        pg.forma_pagamento,
        pg.valor,
        pg.moeda,
        pg.status,
        pg.pago_em,
        pg.observacao,
        pg.criado_em
      FROM pagamentos pg
      INNER JOIN usuarios u ON u.id = pg.usuario_id
      INNER JOIN assinaturas a ON a.id = pg.assinatura_id
      INNER JOIN planos p ON p.id = a.plano_id
      WHERE u.excluido_em IS NULL
      ORDER BY pg.id DESC
    `);

    res.json({
      sucesso: true,
      pagamentos: pagamentos.map((pagamento) => ({
        ...pagamento,
        valor: Number(pagamento.valor),
      })),
    });
  } catch (erro) {
    console.error("Erro ao listar pagamentos:", erro);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao buscar pagamentos.",
    });
  }
});

// CONFIRMAR PAGAMENTO PENDENTE
app.patch("/api/admin/pagamentos/:id/confirmar", async (req, res) => {
  let connection;

  try {
    const pagamentoId = Number(req.params.id);

    if (!Number.isInteger(pagamentoId) || pagamentoId <= 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Identificador do pagamento inválido.",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Localiza e bloqueia o pagamento.
    const [pagamentos] = await connection.query(
      `SELECT id, assinatura_id, status
       FROM pagamentos
       WHERE id = ?
       FOR UPDATE`,
      [pagamentoId]
    );

    if (!pagamentos.length) {
      await connection.rollback();

      return res.status(404).json({
        sucesso: false,
        mensagem: "Pagamento não encontrado.",
      });
    }

    const pagamento = pagamentos[0];

    if (pagamento.status !== "pendente") {
      await connection.rollback();

      return res.status(400).json({
        sucesso: false,
        mensagem:
          pagamento.status === "aprovado"
            ? "Este pagamento já foi confirmado."
            : "Somente pagamentos pendentes podem ser confirmados.",
      });
    }

    // Busca a assinatura e a periodicidade do plano.
    const [assinaturas] = await connection.query(
      `SELECT
        a.id,
        a.status,
        a.proxima_cobranca_em,
        p.periodicidade
       FROM assinaturas a
       INNER JOIN planos p ON p.id = a.plano_id
       WHERE a.id = ?
       FOR UPDATE`,
      [pagamento.assinatura_id]
    );

    if (!assinaturas.length) {
      await connection.rollback();

      return res.status(404).json({
        sucesso: false,
        mensagem: "Assinatura vinculada não encontrada.",
      });
    }

    const assinatura = assinaturas[0];

    // Confirma o pagamento.
    await connection.query(
      `UPDATE pagamentos
       SET status = 'aprovado',
           pago_em = NOW()
       WHERE id = ?`,
      [pagamentoId]
    );

    // Define a próxima cobrança conforme o plano.
    if (assinatura.periodicidade === "mensal") {
      await connection.query(
        `UPDATE assinaturas
         SET status = 'ativa',
             inicio_em = COALESCE(inicio_em, NOW()),
             proxima_cobranca_em = DATE_ADD(
               CASE
                 WHEN ? = 'ativa'
                   AND proxima_cobranca_em > NOW()
                 THEN proxima_cobranca_em
                 ELSE NOW()
               END,
               INTERVAL 1 MONTH
             ),
             fim_em = NULL
         WHERE id = ?`,
        [assinatura.status, assinatura.id]
      );
    } else if (assinatura.periodicidade === "anual") {
      await connection.query(
        `UPDATE assinaturas
         SET status = 'ativa',
             inicio_em = COALESCE(inicio_em, NOW()),
             proxima_cobranca_em = DATE_ADD(
               CASE
                 WHEN ? = 'ativa'
                   AND proxima_cobranca_em > NOW()
                 THEN proxima_cobranca_em
                 ELSE NOW()
               END,
               INTERVAL 1 YEAR
             ),
             fim_em = NULL
         WHERE id = ?`,
        [assinatura.status, assinatura.id]
      );
    } else if (assinatura.periodicidade === "gratuito") {
      await connection.query(
        `UPDATE assinaturas
         SET status = 'ativa',
             inicio_em = COALESCE(inicio_em, NOW()),
             proxima_cobranca_em = NULL,
             fim_em = NULL
         WHERE id = ?`,
        [assinatura.id]
      );
    } else {
      await connection.rollback();

      return res.status(400).json({
        sucesso: false,
        mensagem: "Periodicidade do plano inválida.",
      });
    }

    await connection.commit();

    res.json({
      sucesso: true,
      mensagem: "Pagamento confirmado! Assinatura ativada ou renovada com sucesso.",
    });

  } catch (erro) {
    if (connection) await connection.rollback();

    console.error("Erro ao confirmar pagamento:", erro);

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao confirmar pagamento.",
    });

  } finally {
    if (connection) connection.release();
  }
});

// REGISTRAR PAGAMENTO MANUAL

app.post("/api/admin/pagamentos", async (req, res) => {
  let connection;

  try {
    const assinaturaId = Number(req.body.assinatura_id);
    const formaPagamento = String(req.body.forma_pagamento || "");
    const valor = Number(req.body.valor);
    const status = String(req.body.status || "pendente");
    const observacao = String(req.body.observacao || "").trim();

    const formas = [
      "pix", "cartao_credito", "cartao_debito", "boleto",
      "dinheiro", "transferencia", "mercadopago", "outro",
    ];

    if (
      !Number.isInteger(assinaturaId) ||
      assinaturaId <= 0 ||
      !formas.includes(formaPagamento) ||
      !Number.isFinite(valor) ||
      valor <= 0 ||
      !["pendente", "aprovado", "recusado", "cancelado"].includes(status)
    ) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Confira os dados do pagamento.",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Busca a assinatura e a periodicidade do plano.
    const [assinaturas] = await connection.query(
      `SELECT
        a.id,
        a.usuario_id,
        a.status,
        a.proxima_cobranca_em,
        p.periodicidade
       FROM assinaturas a
       INNER JOIN planos p ON p.id = a.plano_id
       WHERE a.id = ?
       FOR UPDATE`,
      [assinaturaId]
    );

    if (!assinaturas.length) {
      await connection.rollback();

      return res.status(404).json({
        sucesso: false,
        mensagem: "Assinatura não encontrada.",
      });
    }

    const assinatura = assinaturas[0];

    if (
      status === "aprovado" &&
      !["mensal", "anual", "gratuito"].includes(assinatura.periodicidade)
    ) {
      await connection.rollback();

      return res.status(400).json({
        sucesso: false,
        mensagem: "Periodicidade do plano inválida.",
      });
    }

    // Registra o pagamento.
    const [resultado] = await connection.query(
      `INSERT INTO pagamentos (
        assinatura_id,
        usuario_id,
        gateway,
        forma_pagamento,
        valor,
        moeda,
        status,
        pago_em,
        observacao
      )
      VALUES (?, ?, 'manual', ?, ?, 'BRL', ?, ?, ?)`,
      [
        assinaturaId,
        assinatura.usuario_id,
        formaPagamento,
        valor,
        status,
        status === "aprovado" ? new Date() : null,
        observacao || null,
      ]
    );

    // Pagamento aprovado: ativa ou renova a assinatura.
    if (status === "aprovado") {
      if (assinatura.periodicidade === "mensal") {
        await connection.query(
          `UPDATE assinaturas
           SET status = 'ativa',
               inicio_em = COALESCE(inicio_em, NOW()),
               proxima_cobranca_em = DATE_ADD(
                 CASE
                   WHEN status = 'ativa'
                     AND proxima_cobranca_em > NOW()
                   THEN proxima_cobranca_em
                   ELSE NOW()
                 END,
                 INTERVAL 1 MONTH
               ),
               fim_em = NULL
           WHERE id = ?`,
          [assinaturaId]
        );
      } else if (assinatura.periodicidade === "anual") {
        await connection.query(
          `UPDATE assinaturas
           SET status = 'ativa',
               inicio_em = COALESCE(inicio_em, NOW()),
               proxima_cobranca_em = DATE_ADD(
                 CASE
                   WHEN status = 'ativa'
                     AND proxima_cobranca_em > NOW()
                   THEN proxima_cobranca_em
                   ELSE NOW()
                 END,
                 INTERVAL 1 YEAR
               ),
               fim_em = NULL
           WHERE id = ?`,
          [assinaturaId]
        );
      } else if (assinatura.periodicidade === "gratuito") {
        await connection.query(
          `UPDATE assinaturas
           SET status = 'ativa',
               inicio_em = COALESCE(inicio_em, NOW()),
               proxima_cobranca_em = NULL,
               fim_em = NULL
           WHERE id = ?`,
          [assinaturaId]
        );
      }
    }

    await connection.commit();

    res.status(201).json({
      sucesso: true,
      mensagem:
        status === "aprovado"
          ? "Pagamento registrado! Assinatura ativada ou renovada com sucesso."
          : "Pagamento registrado com sucesso!",
      pagamento_id: resultado.insertId,
    });
  } catch (erro) {
    if (connection) await connection.rollback();

    console.error("Erro ao registrar pagamento:", erro);

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao registrar pagamento.",
    });

  } finally {
    if (connection) connection.release();
  }
});

// ========================================
// CONFIGURAÇÕES DA EMPRESA
// ========================================

app.get("/api/configuracoes", async (req, res) => {
  try {
    const usuarioId = req.session.userId;

    await pool.query(
      `INSERT IGNORE INTO configuracoes (usuario_id)
       VALUES (?)`,
      [usuarioId]
    );

    const [configuracoes] = await pool.query(
      `SELECT
        id, nome_empresa, documento, telefone, email,
        endereco, validade_padrao_dias,
        condicoes_pagamento, observacoes_padrao
       FROM configuracoes
       WHERE usuario_id = ?`,
      [usuarioId]
    );

    res.json({
      sucesso: true,
      configuracoes: configuracoes[0],
    });
  } catch (erro) {
    console.error("Erro ao buscar configurações:", erro);

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao buscar configurações.",
    });
  }
});

app.put("/api/configuracoes", async (req, res) => {
  try {
    const usuarioId = req.session.userId;

    const {
      nome_empresa,
      documento,
      telefone,
      email,
      endereco,
      validade_padrao_dias,
      condicoes_pagamento,
      observacoes_padrao,
    } = req.body;

    const validade = Number(validade_padrao_dias);

    if (
      !Number.isInteger(validade) ||
      validade < 1 ||
      validade > 3650
    ) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "A validade deve ser entre 1 e 3650 dias.",
      });
    }

    await pool.query(
      `INSERT INTO configuracoes (
        usuario_id, nome_empresa, documento, telefone, email,
        endereco, validade_padrao_dias,
        condicoes_pagamento, observacoes_padrao
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nome_empresa = VALUES(nome_empresa),
        documento = VALUES(documento),
        telefone = VALUES(telefone),
        email = VALUES(email),
        endereco = VALUES(endereco),
        validade_padrao_dias = VALUES(validade_padrao_dias),
        condicoes_pagamento = VALUES(condicoes_pagamento),
        observacoes_padrao = VALUES(observacoes_padrao)`,
      [
        usuarioId,
        nome_empresa?.trim() || null,
        documento?.trim() || null,
        telefone?.trim() || null,
        email?.trim() || null,
        endereco?.trim() || null,
        validade,
        condicoes_pagamento?.trim() || null,
        observacoes_padrao?.trim() || null,
      ]
    );

    const [resultado] = await pool.query(
      `SELECT *
       FROM configuracoes
       WHERE usuario_id = ?`,
      [usuarioId]
    );

    res.json({
      sucesso: true,
      mensagem: "Configurações salvas com sucesso!",
      configuracoes: resultado[0],
    });
  } catch (erro) {
    console.error("Erro ao salvar configurações:", erro);

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao salvar configurações.",
    });
  }
});

// ========================================
// CLIENTES - LISTAR
// ========================================

app.get("/api/clientes", async (req, res) => {
  try {
    const usuarioId = req.session.userId;

    const [clientes] = await pool.query(
      `SELECT
        id, nome, telefone, email,
        cpf_cnpj AS documento, endereco, observacoes
       FROM clientes
       WHERE usuario_id = ?
       ORDER BY id DESC`,
      [usuarioId]
    );

    res.json(clientes);
  } catch (erro) {
    console.error("Erro ao listar clientes:", erro);

    res.status(500).json({
      mensagem: "Erro ao buscar clientes.",
    });
  }
});

// ========================================
// CLIENTES - CADASTRAR
// ========================================

app.post("/api/clientes", async (req, res) => {
  try {
    const usuarioId = req.session.userId;

    const {
      nome,
      telefone,
      email,
      documento,
      endereco,
      observacoes,
    } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({
        mensagem: "O nome do cliente é obrigatório.",
      });
    }

    const [resultado] = await pool.query(
      `INSERT INTO clientes
        (usuario_id, nome, telefone, email, cpf_cnpj, endereco, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        usuarioId,
        nome.trim(),
        telefone || null,
        email || null,
        documento || null,
        endereco || null,
        observacoes || null,
      ]
    );

    const [clientes] = await pool.query(
      `SELECT
        id, nome, telefone, email,
        cpf_cnpj AS documento, endereco, observacoes
       FROM clientes
       WHERE id = ? AND usuario_id = ?`,
      [resultado.insertId, usuarioId]
    );

    res.status(201).json({
      mensagem: "Cliente cadastrado com sucesso!",
      cliente: clientes[0],
    });
  } catch (erro) {
    console.error("Erro ao cadastrar cliente:", erro);

    res.status(500).json({
      mensagem: "Erro ao cadastrar cliente.",
    });
  }
});

// ========================================
// CLIENTES - EDITAR
// ========================================

app.put("/api/clientes/:id", async (req, res) => {
  try {
    const usuarioId = req.session.userId;
    const { id } = req.params;

    const {
      nome,
      telefone,
      email,
      documento,
      endereco,
      observacoes,
    } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({
        mensagem: "O nome do cliente é obrigatório.",
      });
    }

    const [resultado] = await pool.query(
      `UPDATE clientes
       SET nome = ?, telefone = ?, email = ?, cpf_cnpj = ?,
           endereco = ?, observacoes = ?
       WHERE id = ? AND usuario_id = ?`,
      [
        nome.trim(),
        telefone || null,
        email || null,
        documento || null,
        endereco || null,
        observacoes || null,
        id,
        usuarioId,
      ]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensagem: "Cliente não encontrado.",
      });
    }

    const [clientes] = await pool.query(
      `SELECT
        id, nome, telefone, email,
        cpf_cnpj AS documento, endereco, observacoes
       FROM clientes
       WHERE id = ? AND usuario_id = ?`,
      [id, usuarioId]
    );

    res.json({
      mensagem: "Cliente atualizado com sucesso!",
      cliente: clientes[0],
    });
  } catch (erro) {
    console.error("Erro ao atualizar cliente:", erro);

    res.status(500).json({
      mensagem: "Erro ao atualizar cliente.",
    });
  }
});

// ========================================
// CLIENTES - EXCLUIR
// ========================================

app.delete("/api/clientes/:id", async (req, res) => {
  try {
    const usuarioId = req.session.userId;
    const { id } = req.params;

    const [resultado] = await pool.query(
      `DELETE FROM clientes
       WHERE id = ? AND usuario_id = ?`,
      [id, usuarioId]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        mensagem: "Cliente não encontrado.",
      });
    }

    res.json({
      mensagem: "Cliente excluído com sucesso!",
    });
  } catch (erro) {
    console.error("Erro ao excluir cliente:", erro);

    if (erro.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        mensagem:
          "Este cliente possui orçamentos vinculados e não pode ser excluído.",
      });
    }

    res.status(500).json({
      mensagem: "Erro ao excluir cliente.",
    });
  }
});

// ========================================
// ORÇAMENTOS - LISTAR
// ========================================

app.get("/api/orcamentos", async (req, res) => {
  try {
    const usuarioId = req.session.userId;

    const [orcamentos] = await pool.query(
      `SELECT
        o.id, o.cliente_id, o.data_emissao, o.validade,
        o.desconto, o.total, o.status, o.observacoes,
        o.forma_pagamento, o.status_recebimento,
        o.valor_recebido, o.data_recebimento,
        c.nome AS cliente, c.telefone, c.email
       FROM orcamentos o
       INNER JOIN clientes c ON c.id = o.cliente_id
       WHERE o.usuario_id = ?
       ORDER BY o.id DESC`,
      [usuarioId]
    );

    if (orcamentos.length === 0) {
      return res.json([]);
    }

    const ids = orcamentos.map((item) => item.id);
    const placeholders = ids.map(() => "?").join(",");

    const [itens] = await pool.query(
      `SELECT *
       FROM orcamento_itens
       WHERE orcamento_id IN (${placeholders})
       ORDER BY id ASC`,
      ids
    );

    const resposta = orcamentos.map((orcamento) => {
      const itensOrcamento = itens.filter(
        (item) => item.orcamento_id === orcamento.id
      );

      return formatarOrcamento(orcamento, itensOrcamento);
    });

    res.json(resposta);
  } catch (erro) {
    console.error("Erro ao listar orçamentos:", erro);

    res.status(500).json({
      mensagem: "Erro ao buscar orçamentos.",
    });
  }
});

// ========================================
// ORÇAMENTOS - CADASTRAR
// ========================================

app.post("/api/orcamentos", async (req, res) => {
  let connection;

  try {
    const usuarioId = req.session.userId;

    const {
      clienteId,
      dataEmissao,
      validade,
      desconto,
      total,
      status,
      observacoes,
      formaPagamento,
      itens,
    } = req.body;

    if (!clienteId || !dataEmissao) {
      return res.status(400).json({
        mensagem: "Cliente e data de emissão são obrigatórios.",
      });
    }

    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({
        mensagem: "Adicione pelo menos um item ao orçamento.",
      });
    }

    connection = await pool.getConnection();

    const [clientes] = await connection.query(
      `SELECT id FROM clientes
       WHERE id = ? AND usuario_id = ?`,
      [clienteId, usuarioId]
    );

    if (clientes.length === 0) {
      return res.status(404).json({
        mensagem: "Cliente não encontrado.",
      });
    }

    await connection.beginTransaction();

    const [resultado] = await connection.query(
      `INSERT INTO orcamentos (
        usuario_id, cliente_id, data_emissao, validade,
        desconto, total, status, observacoes, forma_pagamento,
        status_recebimento, valor_recebido, data_recebimento
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Aguardando', 0, NULL)`,
      [
        usuarioId,
        clienteId,
        dataEmissao,
        dataValidade(dataEmissao, validade),
        Number(desconto || 0),
        Number(total || 0),
        status || "Pendente",
        observacoes || null,
        formaPagamento || null,
      ]
    );

    await inserirItens(connection, resultado.insertId, itens);

    await connection.commit();

    res.status(201).json({
      sucesso: true,
      mensagem: "Orçamento cadastrado com sucesso!",
      id: resultado.insertId,
    });
  } catch (erro) {
    if (connection) await connection.rollback();

    console.error("Erro ao cadastrar orçamento:", erro);

    res.status(500).json({
      mensagem: erro.message || "Erro ao cadastrar orçamento.",
    });
  } finally {
    if (connection) connection.release();
  }
});

// ========================================
// ORÇAMENTOS - EDITAR
// ========================================

app.put("/api/orcamentos/:id", async (req, res) => {
  let connection;

  try {
    const usuarioId = req.session.userId;
    const { id } = req.params;

    const {
      clienteId,
      dataEmissao,
      validade,
      desconto,
      total,
      status,
      observacoes,
      formaPagamento,
      itens,
    } = req.body;

    if (!clienteId || !dataEmissao || !Array.isArray(itens)) {
      return res.status(400).json({
        mensagem: "Dados do orçamento incompletos.",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [orcamentos] = await connection.query(
      `SELECT id FROM orcamentos
       WHERE id = ? AND usuario_id = ?`,
      [id, usuarioId]
    );

    if (orcamentos.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        mensagem: "Orçamento não encontrado.",
      });
    }

    const [clientes] = await connection.query(
      `SELECT id FROM clientes
       WHERE id = ? AND usuario_id = ?`,
      [clienteId, usuarioId]
    );

    if (clientes.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        mensagem: "Cliente não encontrado.",
      });
    }

    await connection.query(
      `UPDATE orcamentos
       SET cliente_id = ?, data_emissao = ?, validade = ?,
           desconto = ?, total = ?, status = ?, observacoes = ?,
           forma_pagamento = ?
       WHERE id = ? AND usuario_id = ?`,
      [
        clienteId,
        dataEmissao,
        dataValidade(dataEmissao, validade),
        Number(desconto || 0),
        Number(total || 0),
        status || "Pendente",
        observacoes || null,
        formaPagamento || null,
        id,
        usuarioId,
      ]
    );

    await connection.query(
      `DELETE FROM orcamento_itens
       WHERE orcamento_id = ?`,
      [id]
    );

    await inserirItens(connection, id, itens);

    await connection.commit();

    res.json({
      sucesso: true,
      mensagem: "Orçamento atualizado com sucesso!",
    });
  } catch (erro) {
    if (connection) await connection.rollback();

    console.error("Erro ao atualizar orçamento:", erro);

    res.status(500).json({
      mensagem: erro.message || "Erro ao atualizar orçamento.",
    });
  } finally {
    if (connection) connection.release();
  }
});

// ========================================
// RECEBIMENTOS - REGISTRAR PAGAMENTO
// ========================================

app.put("/api/orcamentos/:id/recebimento", async (req, res) => {
  try {
    const usuarioId = req.session.userId;
    const { id } = req.params;

    const [orcamentos] = await pool.query(
      `SELECT id, total, status
       FROM orcamentos
       WHERE id = ? AND usuario_id = ?`,
      [id, usuarioId]
    );

    if (orcamentos.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Orçamento não encontrado.",
      });
    }

    const orcamento = orcamentos[0];

    if (orcamento.status !== "Aprovado") {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Somente orçamentos aprovados podem ser recebidos.",
      });
    }

    const valorRecebido =
      req.body.valorRecebido === undefined
        ? Number(orcamento.total)
        : Number(req.body.valorRecebido);

    const dataRecebimento =
      req.body.dataRecebimento ||
      new Date().toISOString().slice(0, 10);

    if (
      !Number.isFinite(valorRecebido) ||
      valorRecebido <= 0 ||
      valorRecebido > Number(orcamento.total)
    ) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe um valor recebido válido.",
      });
    }

    await pool.query(
      `UPDATE orcamentos
       SET status_recebimento = 'Recebido',
           valor_recebido = ?,
           data_recebimento = ?
       WHERE id = ? AND usuario_id = ?`,
      [valorRecebido, dataRecebimento, id, usuarioId]
    );

    res.json({
      sucesso: true,
      mensagem: "Recebimento registrado com sucesso!",
      recebimento: {
        statusRecebimento: "Recebido",
        valorRecebido,
        dataRecebimento,
      },
    });
  } catch (erro) {
    console.error("Erro ao registrar recebimento:", erro);

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao registrar recebimento.",
    });
  }
});

// ========================================
// RECEBIMENTOS - DESFAZER
// ========================================

app.delete("/api/orcamentos/:id/recebimento", async (req, res) => {
  try {
    const usuarioId = req.session.userId;
    const { id } = req.params;

    const [resultado] = await pool.query(
      `UPDATE orcamentos
       SET status_recebimento = 'Aguardando',
           valor_recebido = 0,
           data_recebimento = NULL
       WHERE id = ? AND usuario_id = ?`,
      [id, usuarioId]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Orçamento não encontrado.",
      });
    }

    res.json({
      sucesso: true,
      mensagem: "Recebimento desfeito com sucesso!",
    });
  } catch (erro) {
    console.error("Erro ao desfazer recebimento:", erro);

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao desfazer recebimento.",
    });
  }
});

// ========================================
// ORÇAMENTOS - EXCLUIR
// ========================================

app.delete("/api/orcamentos/:id", async (req, res) => {
  let connection;

  try {
    const usuarioId = req.session.userId;
    const { id } = req.params;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [orcamentos] = await connection.query(
      `SELECT id FROM orcamentos
       WHERE id = ? AND usuario_id = ?`,
      [id, usuarioId]
    );

    if (orcamentos.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        mensagem: "Orçamento não encontrado.",
      });
    }

    await connection.query(
      `DELETE FROM orcamento_itens
       WHERE orcamento_id = ?`,
      [id]
    );

    await connection.query(
      `DELETE FROM orcamentos
       WHERE id = ? AND usuario_id = ?`,
      [id, usuarioId]
    );

    await connection.commit();

    res.json({
      sucesso: true,
      mensagem: "Orçamento excluído com sucesso!",
    });
  } catch (erro) {
    if (connection) await connection.rollback();

    console.error("Erro ao excluir orçamento:", erro);

    res.status(500).json({
      mensagem: "Erro ao excluir orçamento.",
    });
  } finally {
    if (connection) connection.release();
  }
});

// ========================================
// INICIAR SERVIDOR
// ========================================

async function iniciarServidor() {
  try {
    await pool.query("SELECT 1");

    app.listen(PORT, () => {
      console.log("-----------------------------------");
      console.log("       ORÇAFÁCIL - BACKEND");
      console.log("-----------------------------------");
      console.log(`Servidor rodando em http://localhost:${PORT}`);
      console.log("Autenticação por sessão MySQL ativada.");
      console.log("Permissões de administrador ativadas.");
      console.log("Cadastro administrativo de clientes ativo.");
      console.log("Clientes, orçamentos e recebimentos ativos.");
      console.log("-----------------------------------");
    });
  } catch (erro) {
    console.error("Não foi possível iniciar o servidor:", erro);
    process.exit(1);
  }
}

iniciarServidor();
