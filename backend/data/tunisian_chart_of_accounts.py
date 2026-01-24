# Plan Comptable Tunisien - Système Comptable des Entreprises (SCE)
# Conforme à la norme comptable tunisienne

TUNISIAN_CHART_OF_ACCOUNTS = [
    # CLASSE 1 - COMPTES DE CAPITAUX PROPRES ET PASSIFS NON COURANTS
    {"code": "1", "name": "Comptes de capitaux propres et passifs non courants", "type": "equity", "is_group": True},
    
    # 10 - Capital, réserves et assimilés
    {"code": "10", "name": "Capital, réserves et assimilés", "type": "equity", "is_group": True, "parent_code": "1"},
    {"code": "101", "name": "Capital social", "type": "equity", "is_group": True, "parent_code": "10"},
    {"code": "1011", "name": "Capital souscrit non appelé", "type": "equity", "parent_code": "101"},
    {"code": "1012", "name": "Capital souscrit appelé non versé", "type": "equity", "parent_code": "101"},
    {"code": "1013", "name": "Capital souscrit appelé versé", "type": "equity", "parent_code": "101"},
    {"code": "1014", "name": "Capital souscrit soumis à des conditions particulières", "type": "equity", "parent_code": "101"},
    {"code": "102", "name": "Fonds de dotation", "type": "equity", "parent_code": "10"},
    {"code": "103", "name": "Primes liées au capital social", "type": "equity", "is_group": True, "parent_code": "10"},
    {"code": "1031", "name": "Primes d'émission", "type": "equity", "parent_code": "103"},
    {"code": "1032", "name": "Primes de fusion", "type": "equity", "parent_code": "103"},
    {"code": "1033", "name": "Primes d'apport", "type": "equity", "parent_code": "103"},
    {"code": "1034", "name": "Primes de conversion d'obligations en actions", "type": "equity", "parent_code": "103"},
    {"code": "104", "name": "Écarts de réévaluation", "type": "equity", "parent_code": "10"},
    {"code": "105", "name": "Écarts d'évaluation", "type": "equity", "parent_code": "10"},
    {"code": "106", "name": "Réserves", "type": "equity", "is_group": True, "parent_code": "10"},
    {"code": "1061", "name": "Réserve légale", "type": "equity", "parent_code": "106"},
    {"code": "1062", "name": "Réserves indisponibles", "type": "equity", "parent_code": "106"},
    {"code": "1063", "name": "Réserves statutaires ou contractuelles", "type": "equity", "parent_code": "106"},
    {"code": "1064", "name": "Réserves réglementées", "type": "equity", "parent_code": "106"},
    {"code": "1065", "name": "Réserves facultatives", "type": "equity", "parent_code": "106"},
    {"code": "1068", "name": "Autres réserves", "type": "equity", "parent_code": "106"},
    {"code": "107", "name": "Écart d'équivalence", "type": "equity", "parent_code": "10"},
    {"code": "108", "name": "Compte de l'exploitant", "type": "equity", "parent_code": "10"},
    {"code": "109", "name": "Actionnaires - Capital souscrit non appelé", "type": "equity", "parent_code": "10"},
    
    # 11 - Report à nouveau
    {"code": "11", "name": "Report à nouveau", "type": "equity", "is_group": True, "parent_code": "1"},
    {"code": "110", "name": "Report à nouveau (solde créditeur)", "type": "equity", "parent_code": "11"},
    {"code": "119", "name": "Report à nouveau (solde débiteur)", "type": "equity", "parent_code": "11"},
    
    # 12 - Résultats de l'exercice
    {"code": "12", "name": "Résultats de l'exercice", "type": "equity", "is_group": True, "parent_code": "1"},
    {"code": "120", "name": "Résultat de l'exercice (bénéfice)", "type": "equity", "parent_code": "12"},
    {"code": "129", "name": "Résultat de l'exercice (perte)", "type": "equity", "parent_code": "12"},
    
    # 13 - Autres capitaux propres positifs ou négatifs
    {"code": "13", "name": "Autres capitaux propres positifs ou négatifs", "type": "equity", "is_group": True, "parent_code": "1"},
    {"code": "131", "name": "Subventions d'équipement", "type": "equity", "parent_code": "13"},
    {"code": "132", "name": "Autres subventions d'investissement", "type": "equity", "parent_code": "13"},
    {"code": "133", "name": "Modifications comptables affectées aux capitaux propres", "type": "equity", "parent_code": "13"},
    {"code": "138", "name": "Autres capitaux propres", "type": "equity", "parent_code": "13"},
    {"code": "139", "name": "Subventions d'investissement inscrites au compte de résultat", "type": "equity", "parent_code": "13"},
    
    # 14 - Passifs non courants - Emprunts et dettes assimilées
    {"code": "14", "name": "Passifs non courants - Emprunts et dettes assimilées", "type": "liability", "is_group": True, "parent_code": "1"},
    {"code": "141", "name": "Emprunts obligataires", "type": "liability", "is_group": True, "parent_code": "14"},
    {"code": "1411", "name": "Emprunts obligataires convertibles", "type": "liability", "parent_code": "141"},
    {"code": "1418", "name": "Autres emprunts obligataires", "type": "liability", "parent_code": "141"},
    {"code": "142", "name": "Emprunts auprès des établissements de crédit", "type": "liability", "parent_code": "14"},
    {"code": "143", "name": "Emprunts et dettes financières divers", "type": "liability", "parent_code": "14"},
    {"code": "145", "name": "Dépôts et cautionnements reçus", "type": "liability", "parent_code": "14"},
    {"code": "146", "name": "Comptes courants associés", "type": "liability", "parent_code": "14"},
    
    # 15 - Provisions
    {"code": "15", "name": "Provisions", "type": "liability", "is_group": True, "parent_code": "1"},
    {"code": "151", "name": "Provisions pour risques", "type": "liability", "is_group": True, "parent_code": "15"},
    {"code": "1511", "name": "Provisions pour litiges", "type": "liability", "parent_code": "151"},
    {"code": "1512", "name": "Provisions pour garanties données aux clients", "type": "liability", "parent_code": "151"},
    {"code": "1513", "name": "Provisions pour pertes sur marchés à terme", "type": "liability", "parent_code": "151"},
    {"code": "1514", "name": "Provisions pour amendes et pénalités", "type": "liability", "parent_code": "151"},
    {"code": "1515", "name": "Provisions pour pertes de change", "type": "liability", "parent_code": "151"},
    {"code": "1518", "name": "Autres provisions pour risques", "type": "liability", "parent_code": "151"},
    {"code": "153", "name": "Provisions pour pensions et obligations similaires", "type": "liability", "parent_code": "15"},
    {"code": "155", "name": "Provisions pour impôts", "type": "liability", "parent_code": "15"},
    {"code": "156", "name": "Provisions pour renouvellement des immobilisations", "type": "liability", "parent_code": "15"},
    {"code": "157", "name": "Provisions pour charges à répartir sur plusieurs exercices", "type": "liability", "parent_code": "15"},
    {"code": "158", "name": "Autres provisions pour charges", "type": "liability", "parent_code": "15"},
    
    # 16 - Emprunts et dettes assimilées courants
    {"code": "16", "name": "Emprunts et dettes assimilées courants", "type": "liability", "is_group": True, "parent_code": "1"},
    {"code": "161", "name": "Emprunts obligataires (partie courante)", "type": "liability", "parent_code": "16"},
    {"code": "162", "name": "Emprunts auprès des établissements de crédit (partie courante)", "type": "liability", "parent_code": "16"},
    {"code": "163", "name": "Emprunts et dettes financières divers (partie courante)", "type": "liability", "parent_code": "16"},
    {"code": "165", "name": "Dépôts et cautionnements reçus (partie courante)", "type": "liability", "parent_code": "16"},
    
    # CLASSE 2 - COMPTES D'ACTIFS NON COURANTS
    {"code": "2", "name": "Comptes d'actifs non courants", "type": "asset", "is_group": True},
    
    # 21 - Immobilisations incorporelles
    {"code": "21", "name": "Immobilisations incorporelles", "type": "asset", "is_group": True, "parent_code": "2"},
    {"code": "211", "name": "Frais préliminaires (à classer sous actifs)", "type": "asset", "parent_code": "21"},
    {"code": "212", "name": "Charges à répartir sur plusieurs exercices", "type": "asset", "parent_code": "21"},
    {"code": "213", "name": "Frais de recherche et de développement", "type": "asset", "parent_code": "21"},
    {"code": "214", "name": "Concessions et droits similaires, brevets, licences, marques", "type": "asset", "parent_code": "21"},
    {"code": "215", "name": "Logiciels", "type": "asset", "parent_code": "21"},
    {"code": "216", "name": "Droit au bail", "type": "asset", "parent_code": "21"},
    {"code": "217", "name": "Fonds commercial", "type": "asset", "parent_code": "21"},
    {"code": "218", "name": "Autres immobilisations incorporelles", "type": "asset", "parent_code": "21"},
    {"code": "219", "name": "Immobilisations incorporelles en cours", "type": "asset", "parent_code": "21"},
    
    # 22 - Immobilisations corporelles
    {"code": "22", "name": "Immobilisations corporelles", "type": "asset", "is_group": True, "parent_code": "2"},
    {"code": "221", "name": "Terrains", "type": "asset", "is_group": True, "parent_code": "22"},
    {"code": "2211", "name": "Terrains nus", "type": "asset", "parent_code": "221"},
    {"code": "2212", "name": "Terrains aménagés", "type": "asset", "parent_code": "221"},
    {"code": "2213", "name": "Terrains bâtis", "type": "asset", "parent_code": "221"},
    {"code": "2214", "name": "Terrains de gisement", "type": "asset", "parent_code": "221"},
    {"code": "222", "name": "Constructions", "type": "asset", "is_group": True, "parent_code": "22"},
    {"code": "2221", "name": "Bâtiments industriels", "type": "asset", "parent_code": "222"},
    {"code": "2222", "name": "Bâtiments administratifs et commerciaux", "type": "asset", "parent_code": "222"},
    {"code": "2223", "name": "Installations générales, agencements et aménagements des constructions", "type": "asset", "parent_code": "222"},
    {"code": "2225", "name": "Ouvrages d'infrastructure", "type": "asset", "parent_code": "222"},
    {"code": "223", "name": "Installations techniques, matériel et outillage industriels", "type": "asset", "is_group": True, "parent_code": "22"},
    {"code": "2231", "name": "Installations techniques", "type": "asset", "parent_code": "223"},
    {"code": "2232", "name": "Installations générales", "type": "asset", "parent_code": "223"},
    {"code": "2233", "name": "Matériel industriel", "type": "asset", "parent_code": "223"},
    {"code": "2234", "name": "Outillage industriel", "type": "asset", "parent_code": "223"},
    {"code": "2237", "name": "Agencements et aménagements du matériel et outillage", "type": "asset", "parent_code": "223"},
    {"code": "224", "name": "Matériel de transport", "type": "asset", "parent_code": "22"},
    {"code": "225", "name": "Équipements de bureau", "type": "asset", "is_group": True, "parent_code": "22"},
    {"code": "2251", "name": "Matériel de bureau", "type": "asset", "parent_code": "225"},
    {"code": "2252", "name": "Matériel informatique", "type": "asset", "parent_code": "225"},
    {"code": "2253", "name": "Mobilier de bureau", "type": "asset", "parent_code": "225"},
    {"code": "2256", "name": "Agencements et aménagements des bureaux", "type": "asset", "parent_code": "225"},
    {"code": "228", "name": "Autres immobilisations corporelles", "type": "asset", "is_group": True, "parent_code": "22"},
    {"code": "2281", "name": "Emballages récupérables", "type": "asset", "parent_code": "228"},
    {"code": "2288", "name": "Autres", "type": "asset", "parent_code": "228"},
    {"code": "229", "name": "Immobilisations corporelles en cours", "type": "asset", "is_group": True, "parent_code": "22"},
    {"code": "2291", "name": "Immobilisations corporelles en cours", "type": "asset", "parent_code": "229"},
    {"code": "2297", "name": "Avances et acomptes versés sur commandes d'immobilisations corporelles", "type": "asset", "parent_code": "229"},
    
    # 23 - Immobilisations en concession
    {"code": "23", "name": "Immobilisations en concession", "type": "asset", "is_group": True, "parent_code": "2"},
    {"code": "231", "name": "Terrains en concession", "type": "asset", "parent_code": "23"},
    {"code": "232", "name": "Constructions en concession", "type": "asset", "parent_code": "23"},
    {"code": "233", "name": "Installations techniques en concession", "type": "asset", "parent_code": "23"},
    {"code": "238", "name": "Autres immobilisations en concession", "type": "asset", "parent_code": "23"},
    
    # 24 - Participations et créances rattachées
    {"code": "24", "name": "Participations et créances rattachées", "type": "asset", "is_group": True, "parent_code": "2"},
    {"code": "241", "name": "Titres de participation", "type": "asset", "parent_code": "24"},
    {"code": "242", "name": "Autres titres immobilisés", "type": "asset", "parent_code": "24"},
    {"code": "243", "name": "Titres immobilisés de l'activité de portefeuille", "type": "asset", "parent_code": "24"},
    {"code": "245", "name": "Créances rattachées à des participations", "type": "asset", "parent_code": "24"},
    
    # 25 - Autres actifs financiers non courants
    {"code": "25", "name": "Autres actifs financiers non courants", "type": "asset", "is_group": True, "parent_code": "2"},
    {"code": "251", "name": "Prêts liés à des participations", "type": "asset", "parent_code": "25"},
    {"code": "252", "name": "Prêts au personnel", "type": "asset", "parent_code": "25"},
    {"code": "253", "name": "Prêts consentis aux associés personnes physiques", "type": "asset", "parent_code": "25"},
    {"code": "254", "name": "Fonds de garantie", "type": "asset", "parent_code": "25"},
    {"code": "255", "name": "Dépôts et cautionnements versés", "type": "asset", "parent_code": "25"},
    {"code": "258", "name": "Autres actifs financiers non courants", "type": "asset", "parent_code": "25"},
    
    # 28 - Amortissements des immobilisations
    {"code": "28", "name": "Amortissements des immobilisations", "type": "asset", "is_group": True, "parent_code": "2"},
    {"code": "281", "name": "Amortissements des immobilisations incorporelles", "type": "asset", "is_group": True, "parent_code": "28"},
    {"code": "2811", "name": "Amortissements des frais préliminaires", "type": "asset", "parent_code": "281"},
    {"code": "2812", "name": "Amortissements des charges à répartir", "type": "asset", "parent_code": "281"},
    {"code": "2813", "name": "Amortissements des frais de recherche et développement", "type": "asset", "parent_code": "281"},
    {"code": "2814", "name": "Amortissements des concessions, brevets et droits similaires", "type": "asset", "parent_code": "281"},
    {"code": "2815", "name": "Amortissements des logiciels", "type": "asset", "parent_code": "281"},
    {"code": "2817", "name": "Amortissements du fonds commercial", "type": "asset", "parent_code": "281"},
    {"code": "2818", "name": "Amortissements des autres immobilisations incorporelles", "type": "asset", "parent_code": "281"},
    {"code": "282", "name": "Amortissements des immobilisations corporelles", "type": "asset", "is_group": True, "parent_code": "28"},
    {"code": "2821", "name": "Amortissements des terrains", "type": "asset", "parent_code": "282"},
    {"code": "2822", "name": "Amortissements des constructions", "type": "asset", "parent_code": "282"},
    {"code": "2823", "name": "Amortissements des installations techniques", "type": "asset", "parent_code": "282"},
    {"code": "2824", "name": "Amortissements du matériel de transport", "type": "asset", "parent_code": "282"},
    {"code": "2825", "name": "Amortissements des équipements de bureau", "type": "asset", "parent_code": "282"},
    {"code": "2828", "name": "Amortissements des autres immobilisations corporelles", "type": "asset", "parent_code": "282"},
    {"code": "283", "name": "Amortissements des immobilisations en concession", "type": "asset", "parent_code": "28"},
    
    # 29 - Provisions pour dépréciation des actifs non courants
    {"code": "29", "name": "Provisions pour dépréciation des actifs non courants", "type": "asset", "is_group": True, "parent_code": "2"},
    {"code": "291", "name": "Provisions pour dépréciation des immobilisations incorporelles", "type": "asset", "parent_code": "29"},
    {"code": "292", "name": "Provisions pour dépréciation des immobilisations corporelles", "type": "asset", "parent_code": "29"},
    {"code": "293", "name": "Provisions pour dépréciation des immobilisations en concession", "type": "asset", "parent_code": "29"},
    {"code": "294", "name": "Provisions pour dépréciation des participations", "type": "asset", "parent_code": "29"},
    {"code": "295", "name": "Provisions pour dépréciation des autres actifs financiers", "type": "asset", "parent_code": "29"},
    
    # CLASSE 3 - COMPTES DE STOCKS
    {"code": "3", "name": "Comptes de stocks", "type": "asset", "is_group": True},
    
    # 31 - Matières premières et fournitures liées
    {"code": "31", "name": "Matières premières et fournitures liées", "type": "asset", "is_group": True, "parent_code": "3"},
    {"code": "311", "name": "Matières premières", "type": "asset", "parent_code": "31"},
    {"code": "312", "name": "Matières consommables", "type": "asset", "parent_code": "31"},
    {"code": "313", "name": "Fournitures consommables", "type": "asset", "parent_code": "31"},
    {"code": "314", "name": "Emballages non récupérables", "type": "asset", "parent_code": "31"},
    {"code": "315", "name": "Emballages récupérables non identifiables", "type": "asset", "parent_code": "31"},
    {"code": "316", "name": "Emballages à usage mixte", "type": "asset", "parent_code": "31"},
    
    # 32 - Autres approvisionnements
    {"code": "32", "name": "Autres approvisionnements", "type": "asset", "is_group": True, "parent_code": "3"},
    {"code": "321", "name": "Matières consommables", "type": "asset", "parent_code": "32"},
    {"code": "322", "name": "Fournitures consommables", "type": "asset", "parent_code": "32"},
    {"code": "326", "name": "Emballages", "type": "asset", "parent_code": "32"},
    
    # 33 - En-cours de production de biens
    {"code": "33", "name": "En-cours de production de biens", "type": "asset", "is_group": True, "parent_code": "3"},
    {"code": "331", "name": "Produits en cours", "type": "asset", "parent_code": "33"},
    {"code": "335", "name": "Travaux en cours", "type": "asset", "parent_code": "33"},
    
    # 34 - En-cours de production de services
    {"code": "34", "name": "En-cours de production de services", "type": "asset", "is_group": True, "parent_code": "3"},
    {"code": "341", "name": "Études en cours", "type": "asset", "parent_code": "34"},
    {"code": "345", "name": "Prestations de services en cours", "type": "asset", "parent_code": "34"},
    
    # 35 - Stocks de produits
    {"code": "35", "name": "Stocks de produits", "type": "asset", "is_group": True, "parent_code": "3"},
    {"code": "351", "name": "Produits intermédiaires", "type": "asset", "parent_code": "35"},
    {"code": "355", "name": "Produits finis", "type": "asset", "parent_code": "35"},
    {"code": "358", "name": "Produits résiduels (ou matières de récupération)", "type": "asset", "parent_code": "35"},
    
    # 36 - Stocks provenant d'immobilisations
    {"code": "36", "name": "Stocks provenant d'immobilisations", "type": "asset", "is_group": True, "parent_code": "3"},
    
    # 37 - Stocks de marchandises
    {"code": "37", "name": "Stocks de marchandises", "type": "asset", "is_group": True, "parent_code": "3"},
    {"code": "370", "name": "Marchandises", "type": "asset", "parent_code": "37"},
    
    # 39 - Provisions pour dépréciation des stocks
    {"code": "39", "name": "Provisions pour dépréciation des stocks", "type": "asset", "is_group": True, "parent_code": "3"},
    {"code": "391", "name": "Provisions pour dépréciation des matières premières", "type": "asset", "parent_code": "39"},
    {"code": "392", "name": "Provisions pour dépréciation des autres approvisionnements", "type": "asset", "parent_code": "39"},
    {"code": "393", "name": "Provisions pour dépréciation des en-cours de production de biens", "type": "asset", "parent_code": "39"},
    {"code": "394", "name": "Provisions pour dépréciation des en-cours de production de services", "type": "asset", "parent_code": "39"},
    {"code": "395", "name": "Provisions pour dépréciation des stocks de produits", "type": "asset", "parent_code": "39"},
    {"code": "397", "name": "Provisions pour dépréciation des stocks de marchandises", "type": "asset", "parent_code": "39"},
    
    # CLASSE 4 - COMPTES DE TIERS
    {"code": "4", "name": "Comptes de tiers", "type": "liability", "is_group": True},
    
    # 40 - Fournisseurs et comptes rattachés
    {"code": "40", "name": "Fournisseurs et comptes rattachés", "type": "liability", "is_group": True, "parent_code": "4"},
    {"code": "401", "name": "Fournisseurs d'exploitation", "type": "liability", "parent_code": "40"},
    {"code": "403", "name": "Fournisseurs d'exploitation - Effets à payer", "type": "liability", "parent_code": "40"},
    {"code": "404", "name": "Fournisseurs d'immobilisations", "type": "liability", "parent_code": "40"},
    {"code": "405", "name": "Fournisseurs d'immobilisations - Effets à payer", "type": "liability", "parent_code": "40"},
    {"code": "408", "name": "Fournisseurs - Factures non parvenues", "type": "liability", "parent_code": "40"},
    {"code": "409", "name": "Fournisseurs débiteurs - Avances et acomptes versés", "type": "asset", "parent_code": "40"},
    
    # 41 - Clients et comptes rattachés
    {"code": "41", "name": "Clients et comptes rattachés", "type": "asset", "is_group": True, "parent_code": "4"},
    {"code": "411", "name": "Clients", "type": "asset", "parent_code": "41"},
    {"code": "413", "name": "Clients - Effets à recevoir", "type": "asset", "parent_code": "41"},
    {"code": "416", "name": "Clients douteux ou litigieux", "type": "asset", "parent_code": "41"},
    {"code": "417", "name": "Créances sur travaux non encore facturables", "type": "asset", "parent_code": "41"},
    {"code": "418", "name": "Clients - Produits non encore facturés", "type": "asset", "parent_code": "41"},
    {"code": "419", "name": "Clients créditeurs - Avances et acomptes reçus", "type": "liability", "parent_code": "41"},
    
    # 42 - Personnel et comptes rattachés
    {"code": "42", "name": "Personnel et comptes rattachés", "type": "liability", "is_group": True, "parent_code": "4"},
    {"code": "421", "name": "Personnel - Rémunérations dues", "type": "liability", "parent_code": "42"},
    {"code": "422", "name": "Comités d'entreprise et d'établissement", "type": "liability", "parent_code": "42"},
    {"code": "423", "name": "Participation des salariés aux résultats", "type": "liability", "parent_code": "42"},
    {"code": "425", "name": "Personnel - Avances et acomptes", "type": "asset", "parent_code": "42"},
    {"code": "426", "name": "Personnel - Dépôts", "type": "liability", "parent_code": "42"},
    {"code": "427", "name": "Personnel - Oppositions", "type": "liability", "parent_code": "42"},
    {"code": "428", "name": "Personnel - Charges à payer et produits à recevoir", "type": "liability", "parent_code": "42"},
    
    # 43 - État et collectivités publiques
    {"code": "43", "name": "État et collectivités publiques", "type": "liability", "is_group": True, "parent_code": "4"},
    {"code": "431", "name": "Sécurité sociale", "type": "liability", "parent_code": "43"},
    {"code": "432", "name": "Autres organismes sociaux", "type": "liability", "parent_code": "43"},
    {"code": "434", "name": "État - Subventions à recevoir", "type": "asset", "parent_code": "43"},
    {"code": "435", "name": "État - Impôts et taxes à payer", "type": "liability", "is_group": True, "parent_code": "43"},
    {"code": "4351", "name": "État - TVA à payer", "type": "liability", "parent_code": "435"},
    {"code": "4352", "name": "État - Impôts sur les bénéfices à payer", "type": "liability", "parent_code": "435"},
    {"code": "4353", "name": "État - Retenues à la source à payer", "type": "liability", "parent_code": "435"},
    {"code": "4354", "name": "État - Droit de timbre à payer", "type": "liability", "parent_code": "435"},
    {"code": "4358", "name": "État - Autres impôts et taxes à payer", "type": "liability", "parent_code": "435"},
    {"code": "436", "name": "État - TVA récupérable", "type": "asset", "is_group": True, "parent_code": "43"},
    {"code": "4361", "name": "TVA récupérable sur immobilisations", "type": "asset", "parent_code": "436"},
    {"code": "4362", "name": "TVA récupérable sur achats et charges", "type": "asset", "parent_code": "436"},
    {"code": "4366", "name": "TVA déductible sur acomptes versés", "type": "asset", "parent_code": "436"},
    {"code": "4367", "name": "Crédit de TVA à reporter", "type": "asset", "parent_code": "436"},
    {"code": "437", "name": "Autres impôts et taxes recouvrables", "type": "asset", "parent_code": "43"},
    {"code": "438", "name": "État - Charges à payer et produits à recevoir", "type": "liability", "parent_code": "43"},
    {"code": "439", "name": "État - Avances et acomptes versés sur impôts", "type": "asset", "parent_code": "43"},
    
    # 44 - Sociétés du groupe et associés
    {"code": "44", "name": "Sociétés du groupe et associés", "type": "liability", "is_group": True, "parent_code": "4"},
    {"code": "441", "name": "Groupe", "type": "liability", "parent_code": "44"},
    {"code": "442", "name": "Associés - Comptes courants", "type": "liability", "parent_code": "44"},
    {"code": "443", "name": "Associés - Dividendes à payer", "type": "liability", "parent_code": "44"},
    {"code": "444", "name": "Associés - Opérations sur le capital", "type": "liability", "is_group": True, "parent_code": "44"},
    {"code": "4441", "name": "Associés - Versements reçus sur augmentation de capital", "type": "liability", "parent_code": "444"},
    {"code": "4446", "name": "Associés - Versements anticipés sur appels de capital", "type": "liability", "parent_code": "444"},
    {"code": "4447", "name": "Associés - Capital appelé non versé", "type": "asset", "parent_code": "444"},
    {"code": "445", "name": "Associés - Dépôts", "type": "liability", "parent_code": "44"},
    {"code": "448", "name": "Associés - Charges à payer", "type": "liability", "parent_code": "44"},
    
    # 45 - Débiteurs et créditeurs divers
    {"code": "45", "name": "Débiteurs et créditeurs divers", "type": "liability", "is_group": True, "parent_code": "4"},
    {"code": "451", "name": "Obligations cautionnées", "type": "liability", "parent_code": "45"},
    {"code": "453", "name": "Sécurité sociale et autres organismes sociaux", "type": "liability", "parent_code": "45"},
    {"code": "455", "name": "Créditeurs divers", "type": "liability", "parent_code": "45"},
    {"code": "456", "name": "Débiteurs divers", "type": "asset", "parent_code": "45"},
    {"code": "458", "name": "Charges à payer et produits à recevoir", "type": "liability", "parent_code": "45"},
    
    # 46 - Comptes de régularisation
    {"code": "46", "name": "Comptes de régularisation", "type": "liability", "is_group": True, "parent_code": "4"},
    {"code": "461", "name": "Charges constatées d'avance", "type": "asset", "parent_code": "46"},
    {"code": "462", "name": "Produits constatés d'avance", "type": "liability", "parent_code": "46"},
    {"code": "463", "name": "Intérêts courus et non échus à payer", "type": "liability", "parent_code": "46"},
    {"code": "464", "name": "Intérêts courus et non échus à recevoir", "type": "asset", "parent_code": "46"},
    {"code": "468", "name": "Charges à répartir sur plusieurs exercices", "type": "asset", "parent_code": "46"},
    
    # 49 - Provisions pour dépréciation des comptes de tiers
    {"code": "49", "name": "Provisions pour dépréciation des comptes de tiers", "type": "asset", "is_group": True, "parent_code": "4"},
    {"code": "491", "name": "Provisions pour dépréciation des comptes clients", "type": "asset", "parent_code": "49"},
    {"code": "495", "name": "Provisions pour dépréciation des comptes du groupe et associés", "type": "asset", "parent_code": "49"},
    {"code": "496", "name": "Provisions pour dépréciation des comptes de débiteurs divers", "type": "asset", "parent_code": "49"},
    
    # CLASSE 5 - COMPTES FINANCIERS
    {"code": "5", "name": "Comptes financiers", "type": "asset", "is_group": True},
    
    # 51 - Placements courants
    {"code": "51", "name": "Placements courants", "type": "asset", "is_group": True, "parent_code": "5"},
    {"code": "511", "name": "Valeurs mobilières de placement", "type": "asset", "is_group": True, "parent_code": "51"},
    {"code": "5111", "name": "Actions propres", "type": "asset", "parent_code": "511"},
    {"code": "5112", "name": "Actions", "type": "asset", "parent_code": "511"},
    {"code": "5116", "name": "Obligations", "type": "asset", "parent_code": "511"},
    {"code": "5117", "name": "Bons de trésor", "type": "asset", "parent_code": "511"},
    {"code": "5118", "name": "Autres valeurs mobilières de placement", "type": "asset", "parent_code": "511"},
    {"code": "518", "name": "Autres placements courants", "type": "asset", "parent_code": "51"},
    {"code": "519", "name": "Provisions pour dépréciation des placements courants", "type": "asset", "parent_code": "51"},
    
    # 52 - Banques, établissements financiers et assimilés
    {"code": "52", "name": "Banques, établissements financiers et assimilés", "type": "asset", "is_group": True, "parent_code": "5"},
    {"code": "521", "name": "Banques", "type": "asset", "parent_code": "52"},
    {"code": "522", "name": "Banques (solde créditeur - découvert)", "type": "liability", "parent_code": "52"},
    {"code": "525", "name": "Chèques postaux (CCP)", "type": "asset", "parent_code": "52"},
    {"code": "526", "name": "Chèques postaux (solde créditeur)", "type": "liability", "parent_code": "52"},
    {"code": "527", "name": "Autres établissements financiers", "type": "asset", "parent_code": "52"},
    {"code": "528", "name": "Intérêts courus", "type": "liability", "parent_code": "52"},
    
    # 53 - Caisse
    {"code": "53", "name": "Caisse", "type": "asset", "is_group": True, "parent_code": "5"},
    {"code": "531", "name": "Caisse en monnaie nationale", "type": "asset", "parent_code": "53"},
    {"code": "532", "name": "Caisse en devises", "type": "asset", "parent_code": "53"},
    
    # 54 - Régies d'avances et accréditifs
    {"code": "54", "name": "Régies d'avances et accréditifs", "type": "asset", "is_group": True, "parent_code": "5"},
    {"code": "541", "name": "Régies d'avances", "type": "asset", "parent_code": "54"},
    {"code": "542", "name": "Accréditifs", "type": "asset", "parent_code": "54"},
    
    # 55 - Virements internes
    {"code": "55", "name": "Virements internes", "type": "asset", "is_group": True, "parent_code": "5"},
    
    # CLASSE 6 - COMPTES DE CHARGES
    {"code": "6", "name": "Comptes de charges", "type": "expense", "is_group": True},
    
    # 60 - Achats
    {"code": "60", "name": "Achats", "type": "expense", "is_group": True, "parent_code": "6"},
    {"code": "601", "name": "Achats de matières premières et fournitures liées", "type": "expense", "parent_code": "60"},
    {"code": "602", "name": "Achats d'autres approvisionnements", "type": "expense", "parent_code": "60"},
    {"code": "603", "name": "Variations des stocks", "type": "expense", "is_group": True, "parent_code": "60"},
    {"code": "6031", "name": "Variation des stocks de matières premières", "type": "expense", "parent_code": "603"},
    {"code": "6032", "name": "Variation des stocks d'autres approvisionnements", "type": "expense", "parent_code": "603"},
    {"code": "604", "name": "Achats d'études et de prestations de services", "type": "expense", "parent_code": "60"},
    {"code": "605", "name": "Achats de matériel, équipements et travaux", "type": "expense", "parent_code": "60"},
    {"code": "606", "name": "Achats non stockés de matières et fournitures", "type": "expense", "is_group": True, "parent_code": "60"},
    {"code": "6061", "name": "Fournitures non stockables (eau, électricité...)", "type": "expense", "parent_code": "606"},
    {"code": "6063", "name": "Fournitures d'entretien et de petit équipement", "type": "expense", "parent_code": "606"},
    {"code": "6064", "name": "Fournitures administratives", "type": "expense", "parent_code": "606"},
    {"code": "6068", "name": "Autres matières et fournitures", "type": "expense", "parent_code": "606"},
    {"code": "607", "name": "Achats de marchandises", "type": "expense", "parent_code": "60"},
    {"code": "6087", "name": "Variation des stocks de marchandises", "type": "expense", "parent_code": "60"},
    {"code": "609", "name": "Rabais, remises et ristournes obtenus sur achats", "type": "expense", "parent_code": "60"},
    
    # 61 - Services extérieurs
    {"code": "61", "name": "Services extérieurs", "type": "expense", "is_group": True, "parent_code": "6"},
    {"code": "611", "name": "Sous-traitance générale", "type": "expense", "parent_code": "61"},
    {"code": "612", "name": "Redevances de crédit-bail", "type": "expense", "is_group": True, "parent_code": "61"},
    {"code": "6121", "name": "Crédit-bail mobilier", "type": "expense", "parent_code": "612"},
    {"code": "6122", "name": "Crédit-bail immobilier", "type": "expense", "parent_code": "612"},
    {"code": "613", "name": "Locations", "type": "expense", "is_group": True, "parent_code": "61"},
    {"code": "6131", "name": "Locations de terrains", "type": "expense", "parent_code": "613"},
    {"code": "6132", "name": "Locations de constructions", "type": "expense", "parent_code": "613"},
    {"code": "6133", "name": "Locations de matériel et outillage", "type": "expense", "parent_code": "613"},
    {"code": "6135", "name": "Locations de matériel de transport", "type": "expense", "parent_code": "613"},
    {"code": "6138", "name": "Autres locations", "type": "expense", "parent_code": "613"},
    {"code": "614", "name": "Charges locatives et de copropriété", "type": "expense", "parent_code": "61"},
    {"code": "615", "name": "Entretien et réparations", "type": "expense", "is_group": True, "parent_code": "61"},
    {"code": "6151", "name": "Entretien et réparations des terrains", "type": "expense", "parent_code": "615"},
    {"code": "6152", "name": "Entretien et réparations des constructions", "type": "expense", "parent_code": "615"},
    {"code": "6153", "name": "Entretien et réparations des installations et équipements", "type": "expense", "parent_code": "615"},
    {"code": "6155", "name": "Entretien et réparations du matériel de transport", "type": "expense", "parent_code": "615"},
    {"code": "6156", "name": "Entretien et réparations du matériel de bureau", "type": "expense", "parent_code": "615"},
    {"code": "616", "name": "Primes d'assurances", "type": "expense", "is_group": True, "parent_code": "61"},
    {"code": "6161", "name": "Multirisques", "type": "expense", "parent_code": "616"},
    {"code": "6162", "name": "Assurance matériel de transport", "type": "expense", "parent_code": "616"},
    {"code": "6163", "name": "Assurance risques d'exploitation", "type": "expense", "parent_code": "616"},
    {"code": "6168", "name": "Autres primes d'assurances", "type": "expense", "parent_code": "616"},
    {"code": "617", "name": "Études, recherches et documentation", "type": "expense", "is_group": True, "parent_code": "61"},
    {"code": "6171", "name": "Études et recherches", "type": "expense", "parent_code": "617"},
    {"code": "6176", "name": "Documentation générale", "type": "expense", "parent_code": "617"},
    {"code": "618", "name": "Divers services extérieurs", "type": "expense", "is_group": True, "parent_code": "61"},
    {"code": "6181", "name": "Documentation générale", "type": "expense", "parent_code": "618"},
    {"code": "6183", "name": "Congrès et séminaires", "type": "expense", "parent_code": "618"},
    {"code": "6185", "name": "Frais de colloques, séminaires et conférences", "type": "expense", "parent_code": "618"},
    
    # 62 - Autres services extérieurs
    {"code": "62", "name": "Autres services extérieurs", "type": "expense", "is_group": True, "parent_code": "6"},
    {"code": "621", "name": "Personnel extérieur à l'entreprise", "type": "expense", "is_group": True, "parent_code": "62"},
    {"code": "6211", "name": "Personnel intérimaire", "type": "expense", "parent_code": "621"},
    {"code": "6214", "name": "Personnel détaché ou prêté à l'entreprise", "type": "expense", "parent_code": "621"},
    {"code": "622", "name": "Rémunérations d'intermédiaires et honoraires", "type": "expense", "is_group": True, "parent_code": "62"},
    {"code": "6221", "name": "Commissions et courtages sur achats", "type": "expense", "parent_code": "622"},
    {"code": "6222", "name": "Commissions et courtages sur ventes", "type": "expense", "parent_code": "622"},
    {"code": "6224", "name": "Honoraires", "type": "expense", "parent_code": "622"},
    {"code": "6226", "name": "Frais d'actes et de contentieux", "type": "expense", "parent_code": "622"},
    {"code": "6228", "name": "Divers rémunérations d'intermédiaires", "type": "expense", "parent_code": "622"},
    {"code": "623", "name": "Publicité, publications, relations publiques", "type": "expense", "is_group": True, "parent_code": "62"},
    {"code": "6231", "name": "Annonces et insertions", "type": "expense", "parent_code": "623"},
    {"code": "6232", "name": "Échantillons", "type": "expense", "parent_code": "623"},
    {"code": "6233", "name": "Foires et expositions", "type": "expense", "parent_code": "623"},
    {"code": "6234", "name": "Cadeaux à la clientèle", "type": "expense", "parent_code": "623"},
    {"code": "6235", "name": "Primes", "type": "expense", "parent_code": "623"},
    {"code": "6236", "name": "Catalogues et imprimés", "type": "expense", "parent_code": "623"},
    {"code": "6237", "name": "Publications", "type": "expense", "parent_code": "623"},
    {"code": "6238", "name": "Divers (pourboires, dons courants...)", "type": "expense", "parent_code": "623"},
    {"code": "624", "name": "Transports de biens et transport collectif du personnel", "type": "expense", "is_group": True, "parent_code": "62"},
    {"code": "6241", "name": "Transports sur achats", "type": "expense", "parent_code": "624"},
    {"code": "6242", "name": "Transports sur ventes", "type": "expense", "parent_code": "624"},
    {"code": "6243", "name": "Transports entre établissements ou chantiers", "type": "expense", "parent_code": "624"},
    {"code": "6244", "name": "Transports administratifs", "type": "expense", "parent_code": "624"},
    {"code": "6247", "name": "Transport collectif du personnel", "type": "expense", "parent_code": "624"},
    {"code": "6248", "name": "Divers transports", "type": "expense", "parent_code": "624"},
    {"code": "625", "name": "Déplacements, missions et réceptions", "type": "expense", "is_group": True, "parent_code": "62"},
    {"code": "6251", "name": "Voyages et déplacements", "type": "expense", "parent_code": "625"},
    {"code": "6252", "name": "Frais de déménagement", "type": "expense", "parent_code": "625"},
    {"code": "6255", "name": "Frais de missions", "type": "expense", "parent_code": "625"},
    {"code": "6256", "name": "Frais de réceptions", "type": "expense", "parent_code": "625"},
    {"code": "6257", "name": "Frais de restaurant et de spectacles", "type": "expense", "parent_code": "625"},
    {"code": "626", "name": "Frais postaux et de télécommunications", "type": "expense", "is_group": True, "parent_code": "62"},
    {"code": "6261", "name": "Frais d'affranchissement", "type": "expense", "parent_code": "626"},
    {"code": "6262", "name": "Téléphone", "type": "expense", "parent_code": "626"},
    {"code": "6263", "name": "Télécopie", "type": "expense", "parent_code": "626"},
    {"code": "6264", "name": "Internet", "type": "expense", "parent_code": "626"},
    {"code": "627", "name": "Services bancaires et assimilés", "type": "expense", "is_group": True, "parent_code": "62"},
    {"code": "6271", "name": "Frais sur titres", "type": "expense", "parent_code": "627"},
    {"code": "6272", "name": "Commissions et frais sur émission d'emprunts", "type": "expense", "parent_code": "627"},
    {"code": "6275", "name": "Frais sur effets", "type": "expense", "parent_code": "627"},
    {"code": "6276", "name": "Location de coffres", "type": "expense", "parent_code": "627"},
    {"code": "6278", "name": "Autres frais et commissions sur prestations de services", "type": "expense", "parent_code": "627"},
    {"code": "628", "name": "Cotisations et divers", "type": "expense", "is_group": True, "parent_code": "62"},
    {"code": "6281", "name": "Concours divers (cotisations...)", "type": "expense", "parent_code": "628"},
    {"code": "6284", "name": "Frais de recrutement de personnel", "type": "expense", "parent_code": "628"},
    
    # 63 - Charges de personnel
    {"code": "63", "name": "Charges de personnel", "type": "expense", "is_group": True, "parent_code": "6"},
    {"code": "631", "name": "Rémunérations du personnel", "type": "expense", "is_group": True, "parent_code": "63"},
    {"code": "6311", "name": "Salaires et appointements", "type": "expense", "parent_code": "631"},
    {"code": "6312", "name": "Congés payés", "type": "expense", "parent_code": "631"},
    {"code": "6313", "name": "Primes et gratifications", "type": "expense", "parent_code": "631"},
    {"code": "6314", "name": "Indemnités et avantages divers", "type": "expense", "parent_code": "631"},
    {"code": "6315", "name": "Supplément familial", "type": "expense", "parent_code": "631"},
    {"code": "632", "name": "Rémunérations des dirigeants et des administrateurs", "type": "expense", "parent_code": "63"},
    {"code": "633", "name": "Indemnités de préavis et de licenciement", "type": "expense", "parent_code": "63"},
    {"code": "634", "name": "Charges sociales", "type": "expense", "is_group": True, "parent_code": "63"},
    {"code": "6341", "name": "Cotisations aux caisses de sécurité sociale et de prévoyance", "type": "expense", "parent_code": "634"},
    {"code": "6343", "name": "Cotisations aux caisses de retraite", "type": "expense", "parent_code": "634"},
    {"code": "6345", "name": "Cotisations aux mutuelles", "type": "expense", "parent_code": "634"},
    {"code": "6348", "name": "Autres cotisations sociales", "type": "expense", "parent_code": "634"},
    {"code": "635", "name": "Autres charges sociales", "type": "expense", "is_group": True, "parent_code": "63"},
    {"code": "6351", "name": "Versements aux comités d'entreprise et d'établissement", "type": "expense", "parent_code": "635"},
    {"code": "6352", "name": "Versements aux comités d'hygiène et de sécurité", "type": "expense", "parent_code": "635"},
    {"code": "6353", "name": "Versements aux œuvres sociales", "type": "expense", "parent_code": "635"},
    {"code": "6354", "name": "Versements pour formation professionnelle", "type": "expense", "parent_code": "635"},
    {"code": "6358", "name": "Autres charges sociales", "type": "expense", "parent_code": "635"},
    
    # 64 - Impôts, taxes et versements assimilés
    {"code": "64", "name": "Impôts, taxes et versements assimilés", "type": "expense", "is_group": True, "parent_code": "6"},
    {"code": "641", "name": "Impôts, taxes et versements assimilés sur rémunérations", "type": "expense", "is_group": True, "parent_code": "64"},
    {"code": "6411", "name": "Taxe sur les salaires", "type": "expense", "parent_code": "641"},
    {"code": "6412", "name": "Taxe de formation professionnelle (TFP)", "type": "expense", "parent_code": "641"},
    {"code": "6413", "name": "Fonds de promotion du logement pour les salariés (FOPROLOS)", "type": "expense", "parent_code": "641"},
    {"code": "6418", "name": "Autres impôts et taxes sur rémunérations", "type": "expense", "parent_code": "641"},
    {"code": "642", "name": "Impôts sur les revenus", "type": "expense", "parent_code": "64"},
    {"code": "643", "name": "Impôts sur les bénéfices", "type": "expense", "parent_code": "64"},
    {"code": "645", "name": "Autres impôts et taxes", "type": "expense", "is_group": True, "parent_code": "64"},
    {"code": "6451", "name": "Droits d'enregistrement", "type": "expense", "parent_code": "645"},
    {"code": "6452", "name": "Droits de timbre", "type": "expense", "parent_code": "645"},
    {"code": "6453", "name": "Taxe sur les véhicules de sociétés", "type": "expense", "parent_code": "645"},
    {"code": "6454", "name": "Contribution pour le soutien, la promotion et la solidarité (TCL)", "type": "expense", "parent_code": "645"},
    {"code": "6455", "name": "Droits de douane", "type": "expense", "parent_code": "645"},
    {"code": "6458", "name": "Autres impôts et taxes", "type": "expense", "parent_code": "645"},
    
    # 65 - Autres charges d'exploitation
    {"code": "65", "name": "Autres charges d'exploitation", "type": "expense", "is_group": True, "parent_code": "6"},
    {"code": "651", "name": "Redevances pour concessions, brevets, licences et logiciels", "type": "expense", "parent_code": "65"},
    {"code": "652", "name": "Moins-values sur cessions d'actifs immobilisés non financiers", "type": "expense", "parent_code": "65"},
    {"code": "653", "name": "Jetons de présence", "type": "expense", "parent_code": "65"},
    {"code": "654", "name": "Pertes sur créances irrécouvrables", "type": "expense", "parent_code": "65"},
    {"code": "655", "name": "Quote-part de résultat sur opérations faites en commun", "type": "expense", "parent_code": "65"},
    {"code": "656", "name": "Charges nettes sur cessions de titres de placement", "type": "expense", "parent_code": "65"},
    {"code": "658", "name": "Autres charges d'exploitation", "type": "expense", "parent_code": "65"},
    
    # 66 - Charges financières
    {"code": "66", "name": "Charges financières", "type": "expense", "is_group": True, "parent_code": "6"},
    {"code": "661", "name": "Charges d'intérêts", "type": "expense", "is_group": True, "parent_code": "66"},
    {"code": "6611", "name": "Intérêts des emprunts obligataires", "type": "expense", "parent_code": "661"},
    {"code": "6612", "name": "Intérêts des emprunts auprès des établissements de crédit", "type": "expense", "parent_code": "661"},
    {"code": "6613", "name": "Intérêts des autres emprunts et dettes", "type": "expense", "parent_code": "661"},
    {"code": "6614", "name": "Intérêts des comptes courants et dépôts créditeurs", "type": "expense", "parent_code": "661"},
    {"code": "6615", "name": "Intérêts bancaires et sur opérations de financement", "type": "expense", "parent_code": "661"},
    {"code": "6618", "name": "Intérêts des autres dettes", "type": "expense", "parent_code": "661"},
    {"code": "664", "name": "Pertes sur créances liées à des participations", "type": "expense", "parent_code": "66"},
    {"code": "665", "name": "Escomptes accordés", "type": "expense", "parent_code": "66"},
    {"code": "666", "name": "Pertes de change", "type": "expense", "parent_code": "66"},
    {"code": "667", "name": "Moins-values sur cessions de titres de participation", "type": "expense", "parent_code": "66"},
    {"code": "668", "name": "Autres charges financières", "type": "expense", "parent_code": "66"},
    
    # 67 - Éléments extraordinaires (charges)
    {"code": "67", "name": "Éléments extraordinaires (charges)", "type": "expense", "is_group": True, "parent_code": "6"},
    {"code": "671", "name": "Charges extraordinaires", "type": "expense", "parent_code": "67"},
    
    # 68 - Dotations aux amortissements et aux provisions
    {"code": "68", "name": "Dotations aux amortissements et aux provisions", "type": "expense", "is_group": True, "parent_code": "6"},
    {"code": "681", "name": "Dotations aux amortissements et aux provisions - charges d'exploitation", "type": "expense", "is_group": True, "parent_code": "68"},
    {"code": "6811", "name": "Dotations aux amortissements des immobilisations incorporelles et corporelles", "type": "expense", "parent_code": "681"},
    {"code": "6815", "name": "Dotations aux provisions pour risques et charges d'exploitation", "type": "expense", "parent_code": "681"},
    {"code": "6816", "name": "Dotations aux provisions pour dépréciation des actifs courants", "type": "expense", "parent_code": "681"},
    {"code": "6817", "name": "Dotations aux provisions pour dépréciation des actifs non courants", "type": "expense", "parent_code": "681"},
    {"code": "686", "name": "Dotations aux amortissements et aux provisions - charges financières", "type": "expense", "is_group": True, "parent_code": "68"},
    {"code": "6861", "name": "Dotations aux provisions pour risques et charges financières", "type": "expense", "parent_code": "686"},
    {"code": "6864", "name": "Dotations aux provisions pour dépréciation des titres de participation", "type": "expense", "parent_code": "686"},
    {"code": "6865", "name": "Dotations aux provisions pour dépréciation des autres actifs financiers", "type": "expense", "parent_code": "686"},
    {"code": "6866", "name": "Dotations aux provisions pour dépréciation des placements courants", "type": "expense", "parent_code": "686"},
    {"code": "687", "name": "Dotations aux amortissements et aux provisions - éléments extraordinaires", "type": "expense", "parent_code": "68"},
    
    # 69 - Impôts sur les bénéfices et assimilés
    {"code": "69", "name": "Impôts sur les bénéfices et assimilés", "type": "expense", "is_group": True, "parent_code": "6"},
    {"code": "691", "name": "Impôts sur les bénéfices", "type": "expense", "parent_code": "69"},
    {"code": "695", "name": "Impôts différés (charges)", "type": "expense", "parent_code": "69"},
    {"code": "698", "name": "Autres impôts sur les résultats", "type": "expense", "parent_code": "69"},
    
    # CLASSE 7 - COMPTES DE PRODUITS
    {"code": "7", "name": "Comptes de produits", "type": "income", "is_group": True},
    
    # 70 - Ventes de produits fabriqués, prestations de services, marchandises
    {"code": "70", "name": "Ventes de produits fabriqués, prestations de services, marchandises", "type": "income", "is_group": True, "parent_code": "7"},
    {"code": "701", "name": "Ventes de produits finis", "type": "income", "parent_code": "70"},
    {"code": "702", "name": "Ventes de produits intermédiaires", "type": "income", "parent_code": "70"},
    {"code": "703", "name": "Ventes de produits résiduels", "type": "income", "parent_code": "70"},
    {"code": "704", "name": "Travaux", "type": "income", "parent_code": "70"},
    {"code": "705", "name": "Études", "type": "income", "parent_code": "70"},
    {"code": "706", "name": "Prestations de services", "type": "income", "parent_code": "70"},
    {"code": "707", "name": "Ventes de marchandises", "type": "income", "parent_code": "70"},
    {"code": "708", "name": "Produits des activités annexes", "type": "income", "is_group": True, "parent_code": "70"},
    {"code": "7081", "name": "Produits des services exploités dans l'intérêt du personnel", "type": "income", "parent_code": "708"},
    {"code": "7082", "name": "Commissions et courtages", "type": "income", "parent_code": "708"},
    {"code": "7083", "name": "Locations diverses", "type": "income", "parent_code": "708"},
    {"code": "7084", "name": "Mise à disposition de personnel", "type": "income", "parent_code": "708"},
    {"code": "7088", "name": "Autres produits d'activités annexes", "type": "income", "parent_code": "708"},
    {"code": "709", "name": "Rabais, remises et ristournes accordés", "type": "income", "parent_code": "70"},
    
    # 71 - Production stockée (ou déstockage)
    {"code": "71", "name": "Production stockée (ou déstockage)", "type": "income", "is_group": True, "parent_code": "7"},
    {"code": "713", "name": "Variation des stocks des en-cours de production de biens", "type": "income", "parent_code": "71"},
    {"code": "714", "name": "Variation des stocks des en-cours de production de services", "type": "income", "parent_code": "71"},
    {"code": "715", "name": "Variation des stocks de produits", "type": "income", "parent_code": "71"},
    
    # 72 - Production immobilisée
    {"code": "72", "name": "Production immobilisée", "type": "income", "is_group": True, "parent_code": "7"},
    {"code": "721", "name": "Immobilisations incorporelles", "type": "income", "parent_code": "72"},
    {"code": "722", "name": "Immobilisations corporelles", "type": "income", "parent_code": "72"},
    
    # 73 - Subventions d'exploitation
    {"code": "73", "name": "Subventions d'exploitation", "type": "income", "is_group": True, "parent_code": "7"},
    {"code": "731", "name": "Subventions d'exploitation", "type": "income", "parent_code": "73"},
    {"code": "739", "name": "Quote-part de subvention d'investissement transférée au résultat", "type": "income", "parent_code": "73"},
    
    # 74 - Autres produits d'exploitation
    {"code": "74", "name": "Autres produits d'exploitation", "type": "income", "is_group": True, "parent_code": "7"},
    {"code": "741", "name": "Revenus des immeubles non affectés aux activités professionnelles", "type": "income", "parent_code": "74"},
    {"code": "742", "name": "Redevances pour concessions, brevets, licences et logiciels", "type": "income", "parent_code": "74"},
    {"code": "743", "name": "Plus-values sur cessions d'actifs immobilisés non financiers", "type": "income", "parent_code": "74"},
    {"code": "745", "name": "Quote-part de résultat sur opérations faites en commun", "type": "income", "parent_code": "74"},
    {"code": "746", "name": "Produits nets sur cessions de titres de placement", "type": "income", "parent_code": "74"},
    {"code": "748", "name": "Autres produits d'exploitation", "type": "income", "parent_code": "74"},
    {"code": "749", "name": "Reprises sur provisions et transferts de charges d'exploitation", "type": "income", "is_group": True, "parent_code": "74"},
    {"code": "7491", "name": "Reprises sur provisions", "type": "income", "parent_code": "749"},
    {"code": "7495", "name": "Transferts de charges d'exploitation", "type": "income", "parent_code": "749"},
    
    # 75 - Produits financiers
    {"code": "75", "name": "Produits financiers", "type": "income", "is_group": True, "parent_code": "7"},
    {"code": "751", "name": "Produits des participations", "type": "income", "parent_code": "75"},
    {"code": "752", "name": "Produits des autres actifs financiers", "type": "income", "parent_code": "75"},
    {"code": "753", "name": "Revenus des créances", "type": "income", "parent_code": "75"},
    {"code": "754", "name": "Revenus des placements courants", "type": "income", "parent_code": "75"},
    {"code": "755", "name": "Escomptes obtenus", "type": "income", "parent_code": "75"},
    {"code": "756", "name": "Gains de change", "type": "income", "parent_code": "75"},
    {"code": "757", "name": "Plus-values sur cessions de titres de participation", "type": "income", "parent_code": "75"},
    {"code": "758", "name": "Autres produits financiers", "type": "income", "parent_code": "75"},
    {"code": "759", "name": "Reprises sur provisions et transferts de charges financières", "type": "income", "is_group": True, "parent_code": "75"},
    {"code": "7591", "name": "Reprises sur provisions pour dépréciation des participations", "type": "income", "parent_code": "759"},
    {"code": "7592", "name": "Reprises sur provisions pour risques et charges financières", "type": "income", "parent_code": "759"},
    {"code": "7595", "name": "Transferts de charges financières", "type": "income", "parent_code": "759"},
    
    # 77 - Éléments extraordinaires (produits)
    {"code": "77", "name": "Éléments extraordinaires (produits)", "type": "income", "is_group": True, "parent_code": "7"},
    {"code": "771", "name": "Produits extraordinaires", "type": "income", "parent_code": "77"},
    
    # 78 - Reprises sur amortissements et provisions
    {"code": "78", "name": "Reprises sur amortissements et provisions", "type": "income", "is_group": True, "parent_code": "7"},
    {"code": "781", "name": "Reprises sur amortissements et provisions - produits d'exploitation", "type": "income", "parent_code": "78"},
    {"code": "786", "name": "Reprises sur provisions - produits financiers", "type": "income", "parent_code": "78"},
    {"code": "787", "name": "Reprises sur provisions - éléments extraordinaires", "type": "income", "parent_code": "78"},
    
    # 79 - Impôts sur les bénéfices (produits)
    {"code": "79", "name": "Impôts sur les bénéfices (produits)", "type": "income", "is_group": True, "parent_code": "7"},
    {"code": "795", "name": "Impôts différés (produits)", "type": "income", "parent_code": "79"},
]
