// What clients have said, in their words (their Google reviews). Used on the home page, the contact page and the
// location page of the client's own town.
export const testimonials = [
  {
    quote:
      'They completely blew past our expectations. The design is beautifully polished, the development is seamless, and their communication throughout the project was first-class.',
    name: 'Wesley Boyce',
    org: 'brand identity and website',
  },
  {
    quote:
      'I absolutely love the look and feel of my new author website. They are so easy to work with and accommodating. I can recommend OakFox 100%.',
    name: 'Jennifer Lane',
    org: 'Jennifer Lane Writes',
  },
];

export const testimonialBy = (name: string) => testimonials.find((t) => t.name === name);
