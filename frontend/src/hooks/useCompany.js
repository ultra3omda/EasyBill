import { useState, useEffect } from 'react';
import { companiesAPI } from '../services/api';

export const useCompany = () => {
  const [companies, setCompanies] = useState([]);
  const [currentCompany, setCurrentCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const response = await companiesAPI.list();
      const companiesList = response.data;
      setCompanies(companiesList);
      
      // Set first company as current if available
      if (companiesList.length > 0) {
        const savedCompanyId = localStorage.getItem('currentCompanyId');
        const company = savedCompanyId 
          ? companiesList.find(c => c.id === savedCompanyId) || companiesList[0]
          : companiesList[0];
        setCurrentCompany(company);
        localStorage.setItem('currentCompanyId', company.id);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchCompany = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    if (company) {
      setCurrentCompany(company);
      localStorage.setItem('currentCompanyId', company.id);
    }
  };

  return {
    companies,
    currentCompany,
    loading,
    loadCompanies,
    switchCompany
  };
};
