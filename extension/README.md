# Partelís · captura WhatsApp (piloto)

1. Baixe a pasta extension do repositório.
2. Abra chrome://extensions (ou edge://extensions), ative Modo do desenvolvedor e escolha Carregar sem compactação; selecione extension.
3. Entre em https://partelis.com.br/login e abra https://web.whatsapp.com.
4. Abra uma conversa individual e clique Criar card no Partelís.
5. Confira nome, telefone com país e DDD, área, responsável e próximo contato; salve.

O formulário usa a sessão autenticada do Partelís. A extensão não guarda senha, token ou sessão do WhatsApp, não acessa histórico e não envia mensagens. Apenas o nome visível e o texto expressamente selecionado são enviados no fragmento da URL, removido ao carregar. Telefone não visível deve ser informado. Não capture grupos. O botão depende da estrutura atual do WhatsApp Web e exige homologação em conversa real. Sem captura automática em segundo plano.

Cliente e card são distintos. Telefone existente reutiliza cliente. Card aberto é reaproveitado, exceto quando marcada nova oportunidade. Reenvio da mesma captura não duplica card. Conflito concorrente exige atualizar conexão e repetir. Brasil: números locais de 10/11 dígitos recebem 55; para outros países informe código completo. Equivalência entre números brasileiros com e sem nono dígito não é presumida.

É preciso publicar também domain.js, server.cjs, whatsapp-capture.html e whatsapp-capture.js. Testes: node --test whatsapp-capture.test.cjs. Este piloto não foi homologado com conta WhatsApp real nem publicado em loja.
