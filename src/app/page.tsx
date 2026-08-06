import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { Especialidades } from '@/components/landing/Especialidades';
import { Sobre } from '@/components/landing/Sobre';
import { Estrutura } from '@/components/landing/Estrutura';
import { CorpoMedico } from '@/components/landing/CorpoMedico';
import { Convenios } from '@/components/landing/Convenios';
import { Preparo } from '@/components/landing/Preparo';
import { Agendamento } from '@/components/landing/Agendamento';
import { Footer } from '@/components/landing/Footer';
import { FloatingWhatsApp } from '@/components/landing/FloatingWhatsApp';
import { CONTATO, EXAMES, GEO_CLINICA } from '@/lib/seed-data';
import { SITE_URL } from '@/lib/site';

// Dados estruturados Schema.org (MedicalClinic) — melhora a exibição
// nos resultados do Google (endereço, telefone, horários) e ajuda a casar
// a página com a ficha do Google Business Profile.
const clinicJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'MedicalClinic',
  name: `${CONTATO.nomeClinica} — ${CONTATO.subtitulo}`,
  url: SITE_URL,
  image: `${SITE_URL}/img/clinica-fachada-entrada.jpg`,
  telephone: '+55-32-3215-8744',
  email: CONTATO.email,
  address: {
    '@type': 'PostalAddress',
    streetAddress: CONTATO.endereco,
    addressLocality: 'Juiz de Fora',
    addressRegion: 'MG',
    addressCountry: 'BR',
  },
  // Só entra no JSON-LD quando preenchido — coordenada errada posiciona a
  // clínica no lugar errado no mapa, o que é pior que não informar nada.
  ...(GEO_CLINICA
    ? { geo: { '@type': 'GeoCoordinates', latitude: GEO_CLINICA.latitude, longitude: GEO_CLINICA.longitude } }
    : {}),
  hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTATO.enderecoCompleto)}`,
  medicalSpecialty: 'Cardiovascular',
  areaServed: {
    '@type': 'City',
    name: 'Juiz de Fora',
    containedInPlace: { '@type': 'State', name: 'Minas Gerais' },
  },
  currenciesAccepted: 'BRL',
  // Exames como serviços — são os termos que as pessoas efetivamente buscam.
  availableService: EXAMES.map((e) => ({
    '@type': 'MedicalTest',
    name: e.nome,
  })),
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      opens: '08:00',
      closes: '18:00',
    },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Friday', opens: '08:00', closes: '17:00' },
  ],
  sameAs: [CONTATO.instagram],
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(clinicJsonLd) }}
      />
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-navyblue-900 focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo" className="bg-canvas">
        <Hero />
        <Especialidades />
        <Sobre />
        <Estrutura />
        <CorpoMedico />
        <Convenios />
        <Preparo />
        <Agendamento />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
