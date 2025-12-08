import {supabase} from '../utils/supabaseClient.js';

export const verifyuser = async(req,res,next) => {
 try{
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid auth header" });
    }

    const token = authHeader.split(" ")[1];
    if(!token) return res.status(401).json({error: "Missing auth token"})

    const {data,error} = await supabase.auth.getUser(token)

     if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    
    req.user = data.user
    next()
 }   catch(err){
    res.status(401).json({error: "Unauthorized"})
 }
}