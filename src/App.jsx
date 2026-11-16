
import "./App.css";
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
} from "lucide-react";

function App() {
  const orcamentos = [
    {
      numero: "#0001",
      cliente: "João da Silva",
      servico: "Instalação elétrica",
      valor: "R$ 1.850,00",
      status: "Pendente",
    },
    {
      numero: "#0002",
      cliente: "Maria Oliveira",
      servico: "Pintura residencial",
      valor: "R$ 2.400,00",
      status: "Aprovado",
    },
    {
      numero: "#0003",
      cliente: "Carlos Santos",
      servico: "Manutenção hidráulica",
      valor: "R$ 750,00",
      status: "Concluído",
    },
  ];

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
          <a className="menu-item active" href="#">
            <LayoutDashboard size={19} />
            Dashboard
          </a>

          <a className="menu-item" href="#">
            <FileText size={19} />
            Orçamentos
          </a>

          <a className="menu-item" href="#">
            <Users size={19} />
            Clientes
          </a>

          <a className="menu-item" href="#">
            <Receipt size={19} />
            Recibos
          </a>
        </nav>

        <div className="sidebar-bottom">
          <a className="menu-item" href="#">
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

          <button className="notification">
            <Bell size={20} />
          </button>
        </header>

        <section className="content">
          <div className="welcome">
            <div>
              <span className="date-label">PAINEL DE CONTROLE</span>
              <h1>Visão geral</h1>
              <p>Bem-vindo ao seu painel de gestão.</p>
            </div>

            <button className="primary-button">
              <Plus size={19} />
              Novo orçamento
            </button>
          </div>

          <div className="stats">
            <StatCard
              icon={<FileText />}
              title="Total de orçamentos"
              value="24"
              detail="Documentos criados"
              color="green"
            />

            <StatCard
              icon={<Clock />}
              title="Pendentes"
              value="08"
              detail="Aguardando aprovação"
              color="yellow"
            />

            <StatCard
              icon={<CheckCircle2 />}
              title="Aprovados"
              value="12"
              detail="Orçamentos aprovados"
              color="blue"
            />

            <StatCard
              icon={<Wallet />}
              title="Total recebido"
              value="R$ 8.450"
              detail="Valores registrados"
              color="purple"
            />
          </div>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Orçamentos recentes</h2>
                <p>Acompanhe seus últimos documentos.</p>
              </div>

              <button className="secondary-button">
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
                  </tr>
                </thead>

                <tbody>
                  {orcamentos.map((item) => (
                    <tr key={item.numero}>
                      <td>{item.numero}</td>
                      <td>{item.cliente}</td>
                      <td>{item.servico}</td>
                      <td className="value">{item.valor}</td>
                      <td>
                        <span
                          className={`status ${item.status.toLowerCase()}`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
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
                Crie orçamentos profissionais e mantenha seus
                clientes sempre organizados.
              </p>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

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
