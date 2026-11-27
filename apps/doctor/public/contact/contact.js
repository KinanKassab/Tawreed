window.va = window.va || function () {
  (window.vaq = window.vaq || []).push(arguments);
};

const posterPath = '/contact/poster/dental-a5';
const landingPath = location.pathname.replace(/\/$/, '') === posterPath ? posterPath : '/contact';

for (const link of document.querySelectorAll('[data-contact-action]')) {
  const action = link.dataset.contactAction;
  if (action === 'catalog' && landingPath === posterPath) {
    link.href = '/catalog?ref=dental-a5&utm_source=campus&utm_medium=print&utm_campaign=dental_students';
  }
  const trackSelection = () => {
    // Hobby provides page views. Keep each selection in a distinct path, separate from QR arrivals.
    const path = `${landingPath}/out/${action}`;
    window.va('pageview', { path, route: path });
  };
  link.addEventListener('click', trackSelection);
  link.addEventListener('auxclick', (event) => {
    if (event.button === 1) trackSelection();
  });
}
