const ford = 'https://www.ford.com.vn/content/dam/Ford/vn/nameplate/transit/transit-premium-16-seats';
const kia = 'https://www.kia.com/content/dam/kwcms/ph/en/images/showroom/carnival-new/Gallery/new';

module.exports = {
  'Ford Transit': [
    ford + '/billboard/transit-premium-16-seats-desktop-mobile.webp',
    ford + '/card/transit-premium-16-seats-feature-02.webp',
    ford + '/card/transit-premium-16-seats-feature-03.webp',
    ford + '/card/transit-premium-16-seats-feature-01.webp',
  ],
  'Kia Carnival': ['01', '05', '02', '08'].map((id) => kia + '/carnival-thumb-' + id + '.jpg'),
};
