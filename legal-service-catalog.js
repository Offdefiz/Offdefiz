/* Partelís — catálogo inicial de serviços e contexto jurídico (v1).
 * Sugestões editáveis: NÃO são peças processuais, aconselhamento automático,
 * tabela de honorários, prazo legal ou promessa de resultado.
 */
(function(factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(typeof window!=='undefined')window.PartelisServices=api;})(function(){'use strict';
const VERSION='2026-11-11';
const AREA_NAMES={
 bancario:'Bancário',civel:'Cível',penal:'Penal',trabalhista:'Trabalhista',
 tributario:'Tributário',previdenciario:'Previdenciário',familia_sucessoes:'Família e Sucessões',
 empresarial_societario:'Empresarial e Societário',administrativo:'Administrativo',
 consumidor:'Consumidor',imobiliario:'Imobiliário',ambiental:'Ambiental',
 digital_dados:'Digital e Proteção de Dados',outra:'Outra'
};
const INTAKE={
 bancario:['Instituição financeira','Tipo de operação de crédito','Instrumento contratual','Saldo informado','Garantias','Existência de cobrança ou demanda'],
 civel:['Relação jurídica','Fatos e datas relevantes','Documentos comprobatórios','Valor econômico estimado','Urgência alegada'],
 penal:['Condição processual','Investigação ou processo','Autoridade competente','Restrição de liberdade','Audiências e intimações recebidas'],
 trabalhista:['Parte representada','Admissão e desligamento','Função e jornada','Remuneração','Verbas ou pedidos controvertidos'],
 tributario:['Ente tributante','Espécie tributária','Período de apuração','Auto de infração ou CDA','Situação administrativa'],
 previdenciario:['Benefício pretendido ou recebido','CNIS e vínculos','DER e decisão administrativa','Contribuições e carências','Condição pessoal pertinente'],
 familia_sucessoes:['Vínculo familiar','Partes envolvidas','Existência de menores ou incapazes','Bens e dívidas','Existência de conflito ou consenso'],
 empresarial_societario:['Tipo societário','Atividade econômica','Sócios e participação','Instrumentos societários','Passivos e contingências'],
 administrativo:['Ente e órgão público','Ato impugnado','Número do procedimento','Data da ciência','Via administrativa disponível'],
 consumidor:['Fornecedor','Produto ou serviço','Contrato e comprovantes','Protocolos anteriores','Danos alegados'],
 imobiliario:['Matrícula e cartório','Posse e titularidade','Instrumentos de compra ou locação','Notificações','Situação de ocupação'],
 ambiental:['Órgão ambiental','Empreendimento ou atividade','Licenças e condicionantes','Notificações ou autuações','Potencial impacto'],
 digital_dados:['Papel como controlador ou operador','Sistema envolvido','Dados tratados','Base e finalidade do tratamento','Incidente ou solicitação recebida'],
 outra:['Problema jurídico','Partes envolvidas','Documentos disponíveis','Objetivo','Urgência']
};
const DOCUMENTS={
 bancario:['Instrumentos bancários disponíveis','Comprovantes e demonstrativos','Comunicações com instituição financeira'],
 civel:['Contratos ou documentos-base','Comprovantes de fatos','Mensagens e notificações pertinentes'],
 penal:['Autos e intimações disponíveis','Documentos de identificação','Cronologia dos fatos e elementos de defesa'],
 trabalhista:['CTPS e documentos de vínculo','Recibos, controles e comunicações','Documentos relacionados aos pedidos'],
 tributario:['Auto de infração ou CDA, se houver','Declarações e demonstrativos fiscais','Comprovantes e decisões'],
 previdenciario:['CNIS e documentos previdenciários','Comprovantes de contribuição e vínculo','Comunicações e decisões do INSS'],
 familia_sucessoes:['Certidões e documentos familiares','Documentos de bens e rendimentos','Comprovantes pertinentes à pretensão'],
 empresarial_societario:['Atos societários e alterações','Contratos e correspondências','Documentação contábil pertinente'],
 administrativo:['Edital, ato ou portaria','Notificações e decisões','Documentos funcionais ou administrativos'],
 consumidor:['Contrato e nota fiscal','Comprovantes de pagamento','Protocolos, mensagens e registros'],
 imobiliario:['Matrícula atualizada, quando disponível','Contratos e comprovantes','Documentos de posse e notificações'],
 ambiental:['Licenças e processos ambientais','Autos e notificações','Estudos ou laudos disponíveis'],
 digital_dados:['Políticas e contratos vigentes','Registro de tratamento ou incidente','Solicitações e evidências pertinentes'],
 outra:['Documentos apresentados pelo cliente','Histórico e evidências pertinentes']
};
const FLOWS={
 consultivo:['Recepção e conferência documental','Análise e reunião de alinhamento','Entrega de parecer ou instrumentos previstos','Orientações finais e encerramento'],
 extrajudicial:['Triagem e coleta de documentos','Análise de alternativas e riscos','Comunicações e diligências autorizadas','Entrega ou encerramento documentado'],
 negociacao:['Triagem e documentação das posições','Definição de limites de negociação com o cliente','Contato e registro de contrapropostas autorizadas','Revisão jurídica e formalização, caso haja consenso'],
 administrativo:['Análise dos atos e documentos','Definição da estratégia administrativa','Preparação de requerimento ou defesa','Acompanhamento e revisão de decisão'],
 judicial:['Análise inicial e documentos','Definição de pedidos e estratégia','Protocolo e acompanhamento dos atos incluídos','Revisão das decisões e próximos passos'],
 defesa:['Acesso aos autos e análise da acusação ou demanda','Definição da estratégia defensiva','Elaboração das manifestações e atuação nas etapas contratadas','Análise de decisão e eventuais medidas posteriores']
};
const MODE_NAMES={consultivo:'Consultoria',extrajudicial:'Atuação extrajudicial',negociacao:'Negociação / acordo',administrativo:'Procedimento administrativo',judicial:'Atuação judicial',defesa:'Defesa técnica'};
const defs=[];
function add(area,entries){for(const [code,title,mode,scope,exclusions] of entries){
 if(!MODE_NAMES[mode])throw Error('Modalidade inválida');
 defs.push(Object.freeze({id:area+'.'+code,areaCode:area,areaName:AREA_NAMES[area],
  title,mode,modality:MODE_NAMES[mode],scope,exclusions:exclusions||
  'Recursos, medidas incidentais, execução e serviços não descritos na proposta dependem de contratação ou ajuste expresso.',
  intake:INTAKE[area],documents:DOCUMENTS[area],steps:FLOWS[mode],
  agreementPossible:mode==='negociacao',version:VERSION,reviewRequired:true}));
}}
add('bancario',[
 ['diagnostico_passivo','Diagnóstico de passivo bancário','consultivo','Analisar operações e documentos disponibilizados, identificar riscos e alternativas de atuação.'],
 ['renegociacao','Renegociação de dívidas bancárias','negociacao','Mapear contratos e credores, preparar estratégias e conduzir tratativas autorizadas.','A obtenção de descontos, quitação ou aceite pelo credor não é garantida.'],
 ['revisional','Ação revisional de contrato bancário','judicial','Analisar o instrumento e, se viável, propor e acompanhar ação revisional no alcance contratado.'],
 ['busca_apreensao','Defesa em busca e apreensão de bem','defesa','Avaliar autos, garantias e prazos informados para a defesa técnica da parte contratante.'],
 ['execucao_bancaria','Defesa em execução ou cobrança bancária','defesa','Examinar título, exigibilidade, garantias e atos processuais para estratégia defensiva.'],
 ['superendividamento','Tratamento do superendividamento','negociacao','Avaliar a situação contratual e medidas de repactuação cabíveis segundo os requisitos legais.'],
 ['fraude_bancaria','Controvérsia por fraude bancária','judicial','Reunir evidências e avaliar pedidos e medidas de responsabilização decorrentes de operação contestada.']
]);
add('civel',[
 ['indenizacao','Ação indenizatória','judicial','Avaliar responsabilidade civil e provas, estruturar pedidos e conduzir os atos contratados.'],
 ['cobranca','Ação de cobrança','judicial','Examinar a origem do crédito, provas e medidas de cobrança judicial adequadas.'],
 ['execucao_titulo','Execução de título extrajudicial','judicial','Examinar exigibilidade do título e conduzir os atos executivos incluídos no escopo.'],
 ['monitoria','Ação monitória','judicial','Analisar prova escrita e adequação da via monitória, com atuação judicial delimitada.'],
 ['obrigacao_fazer','Obrigação de fazer ou não fazer','judicial','Examinar obrigação e inadimplemento alegado, definir tutela e medidas processuais possíveis.'],
 ['acordo_civel','Negociação de acordo cível','negociacao','Estruturar proposta de composição, condições, concessões e formalização quando juridicamente cabível.']
]);
add('penal',[
 ['inquerito','Acompanhamento de investigação','defesa','Assistência técnica na fase investigativa e providências cabíveis no limite contratado.'],
 ['acao_penal','Defesa em ação penal','defesa','Análise dos autos, estratégia defensiva e atuação nas fases processuais delimitadas.'],
 ['custodia','Audiência de custódia','defesa','Preparação e assistência na audiência de custódia, com exame da situação concreta.'],
 ['habeas_corpus','Habeas corpus','judicial','Avaliação do constrangimento alegado e impetração, caso tecnicamente cabível.'],
 ['tribunal_juri','Defesa em procedimento do júri','defesa','Atuação na fase contratada do procedimento do tribunal do júri.'],
 ['execucao_penal','Atuação em execução penal','defesa','Análise da execução e formulação de pedidos relativos a direitos e benefícios legalmente cabíveis.'],
 ['queixa_crime','Queixa-crime','judicial','Análise de legitimidade, prazo e elementos necessários à iniciativa penal privada.']
]);
add('trabalhista',[
 ['reclamacao','Reclamação trabalhista — reclamante','judicial','Analisar vínculo, fatos e verbas apontadas e propor reclamação nos limites pactuados.'],
 ['defesa_reclamada','Defesa em reclamação trabalhista','defesa','Revisar pedidos e provas e elaborar defesa com atuação nas audiências contratadas.'],
 ['rescisao_indireta','Rescisão indireta','judicial','Examinar faltas alegadas e provas para eventual pretensão de rescisão indireta.'],
 ['acordo_extrajudicial','Acordo extrajudicial trabalhista','negociacao','Analisar concessões recíprocas e estruturar acordo, com homologação quando cabível.'],
 ['execucao','Execução trabalhista','judicial','Acompanhar liquidação e atos de satisfação do crédito no alcance contratado.'],
 ['consultoria','Consultoria trabalhista empresarial','consultivo','Revisar práticas e documentos trabalhistas e orientar adequações definidas no escopo.']
]);
add('tributario',[
 ['auto_infracao','Defesa de auto de infração tributário','administrativo','Examinar autuação e apresentar impugnação ou defesa no procedimento indicado.'],
 ['execucao_fiscal','Defesa em execução fiscal','defesa','Examinar CDA, garantias e medidas processuais pertinentes à execução fiscal.'],
 ['repeticao_indebito','Repetição de indébito tributário','judicial','Analisar recolhimentos e viabilidade de restituição ou compensação pela via cabível.'],
 ['mandado_seguranca','Mandado de segurança tributário','judicial','Avaliar direito alegado e adequação do remédio constitucional para o caso.'],
 ['transacao','Negociação ou transação tributária','negociacao','Verificar modalidades e requisitos vigentes e apoiar tratativas de regularização.'],
 ['planejamento','Planejamento tributário','consultivo','Avaliar operações e regimes no escopo definido, documentando pressupostos e riscos.']
]);
add('previdenciario',[
 ['aposentadoria','Concessão de aposentadoria','administrativo','Analisar histórico contributivo, requisitos e pedido administrativo de benefício.'],
 ['incapacidade','Benefício por incapacidade','administrativo','Examinar requisitos, documentação e procedimento administrativo pertinente.'],
 ['bpc','Benefício de Prestação Continuada — BPC','administrativo','Avaliar critérios legais e documentação para requerimento assistencial.'],
 ['pensao_morte','Pensão por morte','administrativo','Analisar condição de dependente e documentação para o requerimento de pensão.'],
 ['revisao','Revisão de benefício previdenciário','administrativo','Analisar carta de concessão, cálculos e hipóteses de revisão cabíveis.'],
 ['acao_judicial','Ação judicial previdenciária','judicial','Definir pedidos e provas e atuar judicialmente no objeto contratado.']
]);
add('familia_sucessoes',[
 ['divorcio_consensual','Divórcio consensual','extrajudicial','Estruturar termos de consenso e providências cabíveis, com via escolhida conforme requisitos.'],
 ['divorcio_litigioso','Divórcio litigioso','judicial','Analisar pretensões e provas e conduzir o procedimento judicial no objeto pactuado.'],
 ['guarda','Guarda e convivência','judicial','Avaliar a situação familiar e formular medidas relativas à guarda e convivência.'],
 ['alimentos','Fixação ou revisão de alimentos','judicial','Examinar necessidade, possibilidade e provas para pedido de alimentos ou revisão.'],
 ['inventario_extrajudicial','Inventário extrajudicial','extrajudicial','Organizar documentação e acompanhar inventário na via notarial, quando cabível.'],
 ['inventario_judicial','Inventário judicial','judicial','Organizar bens e interessados, orientar partilha e acompanhar fases contratadas.'],
 ['uniao_estavel','Reconhecimento ou dissolução de união estável','judicial','Examinar elementos da relação e demandas de reconhecimento ou dissolução.']
]);
add('empresarial_societario',[
 ['constituicao','Constituição ou alteração societária','consultivo','Estruturar documentos societários e orientar registros previstos no escopo.'],
 ['acordo_socios','Acordo de sócios','consultivo','Negociar e redigir governança, direitos e mecanismos de resolução de conflitos pactuados.'],
 ['contratos','Elaboração ou revisão de contratos empresariais','consultivo','Analisar riscos e redigir ou revisar instrumentos definidos pela contratação.'],
 ['dissolucao','Dissolução ou apuração de haveres','judicial','Examinar relação societária e provas para estratégia de dissolução e apuração.'],
 ['cobranca','Recuperação de crédito empresarial','judicial','Analisar documentos do crédito e definir medidas judiciais de cobrança.'],
 ['recuperacao_judicial','Assessoria em recuperação judicial','judicial','Avaliar requisitos, viabilidade e atuação em procedimento recuperacional delimitado.']
]);
add('administrativo',[
 ['pad','Defesa em processo administrativo disciplinar','defesa','Examinar imputações, autos e oportunidade de defesa no PAD.'],
 ['servidor','Direitos de servidor público','administrativo','Analisar ato funcional e pleito administrativo compatível com os fatos.'],
 ['licitacao','Impugnação ou defesa em licitação','administrativo','Examinar edital ou ato e formular medida administrativa cabível.'],
 ['concurso','Medida relativa a concurso público','judicial','Avaliar edital e ato questionado para eventual medida judicial adequada.'],
 ['sancao','Defesa contra sanção administrativa','defesa','Analisar autuação e elementos de defesa e recurso no procedimento pertinente.']
]);
add('consumidor',[
 ['negativacao','Negativação indevida','judicial','Analisar inscrição contestada, documentos e pedidos cabíveis.'],
 ['vicio_produto','Vício de produto ou serviço','judicial','Examinar garantia, reclamações e medidas relativas ao defeito alegado.'],
 ['cobranca_abusiva','Cobrança abusiva','judicial','Avaliar cobrança e documentos para medidas de cessação e reparação pertinentes.'],
 ['plano_saude','Controvérsia com plano de saúde','judicial','Examinar contrato, indicação e negativa para definição de medidas cabíveis.'],
 ['acordo_consumidor','Acordo em conflito de consumo','negociacao','Organizar tratativas e minuta de composição sujeita à conferência do advogado.']
]);
add('imobiliario',[
 ['despejo','Ação de despejo','judicial','Analisar locação e inadimplemento alegado e conduzir medidas contratadas.'],
 ['revisional_locacao','Revisão ou renovação de locação','judicial','Avaliar contrato e critérios legais para revisão ou renovação.'],
 ['usucapiao','Reconhecimento de usucapião','extrajudicial','Analisar posse e documentação e orientar via notarial ou judicial cabível.'],
 ['distrato','Distrato de compromisso imobiliário','negociacao','Examinar instrumento, valores e viabilidade de composição contratual.'],
 ['regularizacao','Regularização imobiliária','extrajudicial','Mapear pendências documentais e registros e orientar providências específicas.'],
 ['adjudicacao','Adjudicação compulsória','extrajudicial','Examinar título e requisitos para a via extrajudicial ou judicial pertinente.']
]);
add('ambiental',[
 ['auto_infracao','Defesa em auto de infração ambiental','administrativo','Examinar auto e provas e formular defesa administrativa cabível.'],
 ['licenciamento','Assessoria em licenciamento ambiental','consultivo','Avaliar condicionantes e documentação do empreendimento no escopo pactuado.'],
 ['tac','Termo de ajustamento de conduta ambiental','negociacao','Analisar obrigações propostas e negociar medidas juridicamente cabíveis.'],
 ['responsabilidade','Contencioso de responsabilidade ambiental','defesa','Avaliar alegações, provas e obrigações para defesa na demanda.']
]);
add('digital_dados',[
 ['lgpd','Programa de adequação à LGPD','consultivo','Mapear tratamentos e riscos e entregar orientações e instrumentos acordados.'],
 ['incidente','Resposta jurídica a incidente de dados','consultivo','Avaliar fatos e obrigações legais de resposta e comunicação, conforme caso concreto.'],
 ['anpd','Defesa em procedimento da ANPD','administrativo','Examinar procedimento e documentos e formular manifestações cabíveis.'],
 ['conteudo','Remoção de conteúdo e tutela digital','judicial','Analisar conteúdo e responsabilidade para providências adequadas.'],
 ['contratos_digitais','Contratos digitais e tecnologia','consultivo','Elaborar ou revisar instrumentos e riscos regulatórios no escopo pactuado.']
]);
add('outra',[
 ['diagnostico','Diagnóstico jurídico inicial','consultivo','Analisar fatos, documentos e alternativas para orientação delimitada.'],
 ['parecer','Parecer jurídico','consultivo','Realizar estudo fundamentado e entregar parecer sobre questão delimitada.'],
 ['acordo','Negociação e proposta de acordo','negociacao','Estruturar posições e condições para possível composição, sujeita à revisão jurídica.'],
 ['representacao','Representação em procedimento específico','administrativo','Definir objeto e atos de representação conforme área e competência aplicáveis.']
]);
const SERVICES=Object.freeze(defs);
const INDEX=new Map(SERVICES.map(item=>[item.id,item]));
function norm(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
const aliases={
 bancario:['bancario','passivo bancario','revisional','superendividamento','busca e apreensao'],
 penal:['penal','criminal','crime','execucao penal'],
 empresarial_societario:['empresarial e societario','societario','empresarial','holding','comercial'],
 familia_sucessoes:['familia e sucessoes','familia','sucessoes'],
 digital_dados:['digital e protecao de dados','digital','lgpd','protecao de dados'],
};
function matchArea(name){const n=norm(name);for(const [code,label] of Object.entries(AREA_NAMES)){if(norm(label)===n||norm(code)===n)return code;}for(const [code,list] of Object.entries(aliases)){if(list.some(s=>norm(s)===n))return code;}return 'outra';}
function list(area){if(!area)return SERVICES.slice();const code=Object.prototype.hasOwnProperty.call(AREA_NAMES,area)?area:matchArea(area);return SERVICES.filter(s=>s.areaCode===code);}
function get(id){return INDEX.get(String(id||''))||null;}
function context(serviceId,areaName){const item=get(serviceId);if(item)return item;const area=matchArea(areaName);return Object.freeze({id:'',areaCode:area,areaName:AREA_NAMES[area],title:'Serviço jurídico a definir',mode:'consultivo',modality:'Atuação a definir',scope:'Objeto e limites a serem descritos pelo advogado.',exclusions:'Serviços não previstos exigem contratação específica.',intake:INTAKE[area],documents:DOCUMENTS[area],steps:FLOWS.consultivo,agreementPossible:false,version:VERSION,reviewRequired:true});}
function draft(serviceId,areaName){const s=context(serviceId,areaName);return {
 serviceId:s.id,areaCode:s.areaCode,areaName:s.areaName,serviceName:s.title,modality:s.modality,
 scope:s.scope+'\nLimites: '+s.exclusions,
 stepsText:s.steps.map(x=>x+' | A definir com o advogado').join('\n'),
 nextText:['Conferência de documentos e escopo','Validação da proposta pelo advogado','Formalização da contratação, se aceita'].join('\n'),
 documents:s.documents.slice(),intake:s.intake.slice(),agreementPossible:s.agreementPossible,
 warnings:['Proposta preliminar sujeita à análise e revisão profissional.','Nenhum resultado, acordo ou prazo de decisão é garantido.','Custas, despesas, recursos e extensão do patrocínio devem constar expressamente na contratação.'],
 version:VERSION
};}
return Object.freeze({VERSION,AREA_NAMES,INTAKE,DOCUMENTS,FLOWS,SERVICES,matchArea,list,get,context,draft});
});
