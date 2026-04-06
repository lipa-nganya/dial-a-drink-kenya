import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { api } from '../services/api';

const SEOHead = () => {
  const [metaTitle, setMetaTitle] = useState('Alcohol Delivery Nairobi - Dial A Drink Kenya - 24 hours Fast Delivery');
  const [metaDescription, setMetaDescription] = useState('Alcohol delivery in Nairobi and its environs in under 30 minutes! Wide variety of whisky, wine, cognacs, gin etc Call 0723688108 to order.');

  useEffect(() => {
    const fetchSEOSettings = async () => {
      try {
        const [titleRes, descRes] = await Promise.all([
          api.get('/settings/seoMetaTitle'),
          api.get('/settings/seoMetaDescription')
        ]);

        if (titleRes.data?.value) {
          setMetaTitle(titleRes.data.value);
        }
        if (descRes.data?.value) {
          setMetaDescription(descRes.data.value);
        }
      } catch (error) {
        console.warn('Failed to fetch SEO settings, using defaults:', error.message);
      }
    };

    fetchSEOSettings();
  }, []);

  return (
    <Helmet>
      <title>{metaTitle}</title>
      <meta name="description" content={metaDescription} />
    </Helmet>
  );
};

export default SEOHead;
