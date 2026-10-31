interface ShiftMap {
  emoji: string;
  hours: string;
  url: string;
}

const SHIFT_MAPS: ShiftMap[] = [
  {
    emoji: '💀',
    hours: '19h às 20h',
    url: 'https://www.google.com/maps/d/viewer?mid=1Z7_Lvo4L7zRtVY8rpOvNZ1mp5aqPuz0&usp=sharing',
  },
  {
    emoji: '🕷️',
    hours: '20h às 21h',
    url: 'https://www.google.com/maps/d/viewer?mid=1_deIFeVoEHvXanQRf3y3AkXPVEONZGs&usp=sharing',
  },
  {
    emoji: '⚰️',
    hours: '21h às 22h',
    url: 'https://www.google.com/maps/d/viewer?mid=1NSYK8qyoIsuH2Qoo8PkQhY8hdhr0Nt0&usp=sharing',
  },
];

export default function Links() {
  return (
    <div className="page links">
      <header>
        <div className="brand">
          <span className="logo">🎃</span>
          <div>
            <h1>RALV.PARTY</h1>
            <p className="tagline">Casas com doces para o Halloween em Portugal</p>
          </div>
        </div>
        <div className="actions">
          <a className="ghost" href="/">
            Voltar ao mapa
          </a>
        </div>
      </header>

      <main className="info">
        <article className="info-card">
          <h2>Outras Ligações</h2>
          <p>
            Há muiiiiitas, muitas campainhas onde os miúdos podem tocar, oh yeah! Adesão incrível,
            MUiiiiiTO OBRiiiiiiiiiiiGADA!!! 🖤 Ofereçam 1 a 2 doces a cada criança para que cheguem
            para todos e para limitar cáries, hehe! Não se esqueçam que também existe a
            “travessura”, as partidas são muito bem-vindas! 👻
          </p>
          <p>
            Aqui vão os 3 mapas (um por cada "turno"), que ficarão disponíveis 5 minutos antes da
            hora indicada e serão apagados quando começa um novo "turno", para evitar toques
            indesejados antes / depois da hora de inscrição. Exceção para o turno das 19h às 20h,
            que será desvendado pelas 18h00, para se poderem organizar antes da "caça"! 😉 Cliquem
            num pin para tocarem na porta certa! 🦇
          </p>

          <ul className="shift-maps">
            {SHIFT_MAPS.map((shift) => (
              <li key={shift.url}>
                <a href={shift.url} target="_blank" rel="noreferrer">
                  <span className="shift-hours">
                    {shift.emoji} {shift.hours} {shift.emoji}
                  </span>
                  <span className="shift-open">Abrir mapa ↗</span>
                </a>
              </li>
            ))}
          </ul>

          <p>
            Lembro que todos podem participar, mesmo se não se inscreveram para a distribuição. 😉
            Deixa-se a sugestão que podem colaborar fornecendo doces a outras casas! 💥
          </p>
          <p>
            O roteiro e a companhia ficam ao gosto de cada um! O desfile Alvalade-Areeiro Halloween
            Parade começa às 20h30 na Praça de Alvalade e acaba na Alameda. 🧛🏻
          </p>
          <p>
            Diviiiiiiiiirtam-se muito & que seja uma noite assustadoramente incrível com amigos &
            famílias do nosso bairro!
          </p>
          <p className="signature">Julie 💀⚰️</p>
        </article>
      </main>

      <footer>
        <span>Feito com 🎃 em Portugal</span>
      </footer>
    </div>
  );
}
