import React from 'react';

const MarketplaceContext = React.createContext({
  contract: null,
  offerCount: null,
  offers: [],
  auctions: [],
  userFunds: null,
  mktIsLoading: true,
  loadContract: () => {},
  loadOfferCount: () => {},
  loadOffers: () => {},
  loadAuctions: () => {},
  updateOffer: () => {},
  updatePrice: () => {},
  addOffer: () => {},
  loadUserFunds: () => {},
  setMktIsLoading: () => {}
});

export default MarketplaceContext;