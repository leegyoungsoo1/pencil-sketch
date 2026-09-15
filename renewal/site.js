// Keep the guide compact while retaining native keyboard-accessible disclosure controls.
document.querySelectorAll('.faq details').forEach(detail=>detail.addEventListener('toggle',()=>{
  if(detail.open)document.querySelectorAll('.faq details').forEach(other=>{if(other!==detail)other.open=false;});
}));
