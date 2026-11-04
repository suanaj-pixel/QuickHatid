import {
  ArrowLeft, ArrowRight, Bike, GraduationCap, HeartHandshake, Mail, MapPin,
  PackageCheck, ShieldCheck, Target, Users,
} from 'lucide-react'
import './aboutus.css'
import rayLouisCadayPhoto from './assets/team/ray-louis-caday.png'
import allanJrSuanPhoto from './assets/team/allan-jr-suan.png'
import neilAndrieCodezarPhoto from './assets/team/neil-andrie-codezar.png'
import carlSydrickQuintilaPhoto from './assets/team/carl-sydrick-quintila.png'
import seanroeCaserPhoto from './assets/team/seanroe-caser.png'

const team = [
  { name: 'RAY LOUIS CADAY', email: 'cadayrl@sic.edu.ph', tone: 'peach', photo: rayLouisCadayPhoto },
  { name: 'ALLAN JR. SUAN', email: 'suanaj@sic.edu.ph', tone: 'blue', photo: allanJrSuanPhoto },
  { name: 'NEIL ANDRIE CODEZAR', email: 'codezarna@sic.edu.ph', tone: 'green', photo: neilAndrieCodezarPhoto },
  { name: 'CARL SYDRICK QUINTILA', email: 'quintilacs@sic.edu.ph', tone: 'lavender', photo: carlSydrickQuintilaPhoto },
  { name: 'SEANROE CASER', email: null, tone: 'gold', photo: seanroeCaserPhoto },
]

function AboutUs({ onBack }) {
  return (
    <div className="about-page">
      <section className="about-hero">
        <div className="about-hero-copy">
          <span className="about-kicker"><span /> BUILT FOR THE COMMUNITY</span>
          <h1>Getting there,<br />and getting things done,<br /><span>just got easier.</span></h1>
          <p>We’re QuickHatid — a community-first way to find local rides and get everyday errands taken care of.</p>
          <button className="about-back-button" onClick={onBack}><ArrowLeft size={16} /> Back to Home</button>
          <div className="about-hero-location"><MapPin size={15} /> Proudly starting in Don Carlos, Bukidnon</div>
        </div>
        <div className="about-hero-art" aria-hidden="true">
          <div className="about-art-sun" />
          <div className="about-art-route"><span><MapPin size={17} fill="currentColor" /></span><i /><span><MapPin size={17} fill="currentColor" /></span></div>
          <div className="about-art-card"><span><Bike size={21} /></span><div><strong>Local riders, right around the corner</strong><small>Connecting neighbors, one trip at a time</small></div></div>
          <div className="about-art-bag"><PackageCheck size={26} /><span>ON ITS WAY</span></div>
          <span className="about-art-star star-a">✳</span><span className="about-art-star star-b">✦</span>
          <div className="about-art-town"><span className="town-house house-one" /><span className="town-house house-two" /><span className="town-house house-three" /><span className="town-road" /><span className="town-rider"><Bike size={45} /></span></div>
        </div>
        <div className="about-hero-foot"><span><ShieldCheck size={15} /> Community-minded</span><i /><span><HeartHandshake size={15} /> Made to help</span><i /><span><MapPin size={15} /> Rooted in Don Carlos</span></div>
      </section>

      <section className="about-intro about-section">
        <div className="about-section-heading"><span className="about-section-icon orange-icon"><Bike size={19} /></span><div><span className="about-eyebrow">A LITTLE ABOUT US</span><h2>Meet QuickHatid</h2></div></div>
        <div className="about-intro-copy">
          <p>QuickHatid is a web-based platform developed to help people who struggle to find available transportation and those who need convenient errand and delivery services. It aims to provide an easier way for people to request rides and deliveries without spending too much time waiting along the streets for a tricycle or other available transportation.</p>
          <p>The platform is designed to help commuters who experience long waiting times, people who want to avoid traffic-related inconvenience, and residents who need assistance with everyday errands.</p>
          <p>QuickHatid is not only intended for the people of Don Carlos, Bukidnon, but also aims to help other communities by providing a convenient and organized way to connect customers with local riders.</p>
        </div>
        <div className="about-highlight"><span className="highlight-icon"><MapPin size={19} /></span><span><strong>From our community, for every community.</strong><small>Starting in Don Carlos, Bukidnon — with a vision to reach further.</small></span><ArrowRight size={17} /></div>
      </section>

      <section className="about-story">
        <div className="about-story-art" aria-hidden="true"><div className="story-orbit orbit-one" /><div className="story-orbit orbit-two" /><span className="story-icon"><HeartHandshake size={43} /></span><span className="story-star story-star-a">✳</span><span className="story-star story-star-b">✦</span><span className="story-label">A LOCAL IDEA<br />WITH A BIG HEART</span></div>
        <div className="about-story-copy"><span className="about-eyebrow">WHERE IT ALL BEGAN</span><h2>Why We Created<br />QuickHatid</h2><p>We created QuickHatid because we understand the struggles of people who have difficulty finding transportation, especially during busy hours and evenings. Many commuters spend a long time waiting on the streets for an available tricycle or other transportation.</p><p>We also recognize that traffic, busy schedules, and everyday responsibilities make traveling and completing errands difficult for many people.</p><p>As third-year BSIT students of San Isidro College, we developed this project to use technology to provide a practical solution to these everyday problems. Through QuickHatid, we hope to make transportation and errand services more accessible, organized, and convenient for the community.</p></div>
      </section>

      <section className="about-values">
        <div className="about-centered-heading"><span className="about-eyebrow">WHAT WE’RE HERE TO DO</span><h2>A little more ease, every day.</h2><p>Built around the everyday needs of people and the communities they call home.</p></div>
        <div className="about-value-grid">
          <article className="about-value-card mission-card"><span className="value-icon"><Target size={21} /></span><span className="about-eyebrow">OUR MISSION</span><h3>Make everyday journeys simpler.</h3><p>To provide a convenient, accessible, and organized platform that connects people with local riders for transportation and errand delivery services, helping improve everyday mobility and community convenience.</p><span className="value-decoration">01</span></article>
          <article className="about-value-card vision-card"><span className="value-icon"><Users size={21} /></span><span className="about-eyebrow">OUR VISION</span><h3>Growing, together.</h3><p>To become a trusted community-based transportation and errand delivery platform that supports Don Carlos, Bukidnon, and eventually other communities through technology and accessible services.</p><span className="value-decoration">02</span></article>
        </div>
      </section>

      <section className="about-team">
        <div className="about-team-heading"><div><span className="about-eyebrow">THE PEOPLE BEHIND THE PROJECT</span><h2>Meet our team</h2><p>Five student developers, one shared goal: making life a little easier in our community.</p></div><span className="team-count"><Users size={16} /> 5 student developers</span></div>
        <div className="about-team-grid">{team.map((member, index) => <article className="about-person-card" key={member.name}><div className={`person-photo has-photo ${member.tone}`}><img src={member.photo} alt={`${member.name} profile`} /><span className="person-number">0{index + 1}</span></div><div className="person-details"><h3>{member.name}</h3><span className="person-role">BSIT Student Developer</span><div className="person-meta"><GraduationCap size={14} /><span>San Isidro College</span></div><p>Bachelor of Science in<br />Information Technology</p>{member.email ? <a href={`mailto:${member.email}`} className="person-email"><Mail size={13} />{member.email}</a> : <span className="person-email email-missing"><Mail size={13} />No email provided</span>}</div></article>)}</div>
      </section>

      <section className="about-school"><span className="school-icon"><GraduationCap size={26} /></span><div className="school-copy"><span className="about-eyebrow">A STUDENT-DEVELOPED PROJECT</span><h2>Developed by BSIT Students<br />of San Isidro College</h2><p>QuickHatid is a student-developed project created by five third-year Bachelor of Science in Information Technology students from San Isidro College. This project represents our effort to apply our knowledge and skills in information technology to develop a system that addresses real-life problems and provides benefits to the community.</p></div><div className="school-seal"><GraduationCap size={27} /><span>SAN ISIDRO<br />COLLEGE</span></div></section>

      <section className="about-community"><div className="community-decoration community-decoration-one" /><div className="community-decoration community-decoration-two" /><span className="community-icon"><HeartHandshake size={22} /></span><span className="about-eyebrow">OUR GOAL FOR THE COMMUNITY</span><h2>Making Every Ride<br />and Errand <span>Easier.</span></h2><p>Our goal is to help reduce the inconvenience of finding transportation and requesting errand services. We want to give commuters and residents a more convenient option for requesting local riders, saving time, and making everyday activities easier.</p><p>QuickHatid starts with the community of Don Carlos, Bukidnon, but our goal is to make this service useful to other communities as well.</p><button className="community-home-button" onClick={onBack}>Back to Home <ArrowRight size={16} /></button></section>

      <footer className="about-footer"><a className="about-footer-brand" href="#" onClick={(event) => { event.preventDefault(); onBack() }}><span className="about-footer-mark"><Bike size={16} /></span>quick<span>hatid</span></a><span>Made with care in Don Carlos, Bukidnon.</span><button onClick={onBack}>Back to home <ArrowRight size={13} /></button></footer>
    </div>
  )
}

export default AboutUs